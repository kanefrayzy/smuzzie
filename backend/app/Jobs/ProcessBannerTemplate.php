<?php

namespace App\Jobs;

use App\Enums\BannerTemplateStatus;
use App\Models\BannerTemplate;
use App\Services\Banners\BannerConfigValidator;
use App\Services\Banners\BannerMedia;
use App\Services\Banners\TemplateMediaProcessor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Processes a template video or image on the "banners" queue: a new upload (master + preview + poster),
 * or, without an upload, just a fresh preview/poster from the current master
 * (after the watermark settings changed).
 *
 * The template keeps serving its current media until the new files are complete;
 * old previews are removed afterwards, old masters are kept for existing orders.
 */
class ProcessBannerTemplate implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 840; // below the "banners" connection retry_after (900)

    public function __construct(public int $templateId, public ?string $uploadPath = null, public ?int $rev = null)
    {
        $this->onConnection(config('banners.queue.connection'));
        $this->onQueue(config('banners.queue.name'));
    }

    public function handle(TemplateMediaProcessor $processor): void
    {
        $template = BannerTemplate::find($this->templateId);
        if (!$template) {
            $this->discardUpload();
            return;
        }
        // A newer upload replaced this one while it was waiting in the queue
        if ($this->uploadPath && $template->upload_path !== $this->uploadPath) {
            $this->discardUpload();
            return;
        }

        $template->update(['processing_status' => BannerTemplateStatus::Processing, 'processing_error' => null]);
        $oldPreview = [$template->preview_path, $template->poster_path];

        try {
            $fields = $this->uploadPath
                ? $processor->processUpload($template, $this->uploadPath, (int) $this->rev)
                : $processor->rebuildPreview($template);
        } catch (\Throwable $e) {
            $this->markFailed($template, $e);
            return;
        }

        if (isset($fields['kind'])) {
            $fields['outputs'] = $this->outputsFor($template, $fields['kind'], (int) $fields['width']);
        }

        $template->update($fields + [
            'processing_status' => BannerTemplateStatus::Ready,
            'processing_error' => null,
            'processed_at' => now(),
            'upload_path' => $this->uploadPath ? null : $template->upload_path,
        ]);

        $this->discardUpload();
        $stale = array_filter($oldPreview, fn ($p) => $p && !in_array($p, [$fields['preview_path'], $fields['poster_path']], true));
        if ($stale) {
            Storage::disk(config('banners.disks.public'))->delete(array_values($stale));
        }
    }

    /**
     * Result formats after a new upload: switching between video and image starts from the new
     * kind's defaults; a narrower new video lowers the GIF width with it (GIFs are never upscaled).
     */
    private function outputsFor(BannerTemplate $template, string $kind, int $width): array
    {
        $outputs = $template->outputs ?? [];
        if ($kind !== $template->kind) {
            return app(BannerConfigValidator::class)->validateOutputs([], $width, $kind);
        }
        if ($kind === BannerMedia::VIDEO && ($outputs['gif']['width'] ?? 0) > $width) {
            $outputs['gif']['width'] = $width;
        }
        return $outputs;
    }

    /** Called by the worker when the job dies (timeout, crash). */
    public function failed(\Throwable $e): void
    {
        if ($template = BannerTemplate::find($this->templateId)) {
            $this->markFailed($template, $e);
        }
    }

    private function markFailed(BannerTemplate $template, \Throwable $e): void
    {
        Log::error("Banner template #{$template->id} processing failed: {$e->getMessage()}");

        // If an earlier version is complete it keeps being served; the error stays visible in the admin
        $hasMedia = $template->source_path && $template->preview_path;
        $template->update([
            'processing_status' => $hasMedia ? BannerTemplateStatus::Ready : BannerTemplateStatus::Failed,
            'processing_error' => mb_substr(($hasMedia ? 'New video was not applied: ' : '') . $e->getMessage(), 0, 2000),
            'upload_path' => $this->uploadPath && $template->upload_path === $this->uploadPath ? null : $template->upload_path,
        ]);
        $this->discardUpload();
    }

    private function discardUpload(): void
    {
        if ($this->uploadPath) {
            Storage::disk(config('banners.disks.private'))->delete($this->uploadPath);
        }
    }
}
