<?php

namespace App\Services\Banners;

use App\Models\BannerTemplate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Turns an uploaded template video into:
 *  - the private master the renderer uses (always tagged bt709),
 *  - a public ≤720 px preview with the watermark burned in,
 *  - a public WebP poster taken from that preview (so it is watermarked too).
 *
 * Master policy: an H.264 yuv420p upload with even dimensions and bt709/untagged color is
 * remuxed without re-encoding (tags set in the bitstream, faststart); anything else is
 * encoded once at high quality. Untagged sources are treated as bt709.
 *
 * Nothing is written over existing files: every run produces new file names, so a failed
 * run leaves the template's current media untouched.
 */
class TemplateMediaProcessor
{
    private const BT709_TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

    public function __construct(private Ffmpeg $ffmpeg, private WatermarkGenerator $watermark)
    {
    }

    /**
     * Build a new master from an upload plus a matching preview and poster.
     *
     * @return array fields to store on the template once everything succeeded
     */
    public function processUpload(BannerTemplate $template, string $uploadPath, int $rev): array
    {
        $upload = $this->private()->path($uploadPath);
        $info = $this->ffmpeg->probe($upload);
        $this->checkLimits($info);

        $sourcePath = "templates/{$template->uuid}/source-{$rev}-" . Str::lower(Str::random(6)) . '.mp4';
        $source = $this->private()->path($sourcePath);

        if ($this->canRemux($info)) {
            $this->ffmpeg->run([
                '-i', $upload, '-map', '0:v:0', '-an', '-c:v', 'copy',
                '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0',
                '-movflags', '+faststart', '-f', 'mp4',
            ], $source);
        } else {
            $this->ffmpeg->run(array_merge([
                '-i', $upload, '-map', '0:v:0', '-an',
                '-vf', $this->masterFilter($info),
                '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high',
                '-crf', (string) config('banners.template.master_crf', 15),
                '-pix_fmt', 'yuv420p',
            ], self::BT709_TAGS, ['-movflags', '+faststart', '-f', 'mp4']), $source);
        }

        try {
            $master = $this->ffmpeg->probe($source);
            $preview = $this->buildPreview($template, $rev, $sourcePath, $master, $template->watermark ?? []);
        } catch (\Throwable $e) {
            $this->private()->delete($sourcePath);
            throw $e;
        }

        return array_merge($preview, [
            'source_rev' => $rev,
            'source_path' => $sourcePath,
            'width' => $master['width'],
            'height' => $master['height'],
            'fps' => $master['fps'],
            'duration' => $master['duration'],
            'frame_count' => $master['frames'],
        ]);
    }

    /**
     * Rebuild only the preview and poster from the current master (e.g. after the
     * watermark settings changed).
     */
    public function rebuildPreview(BannerTemplate $template): array
    {
        if (!$template->source_path || !$this->private()->exists($template->source_path)) {
            throw new \RuntimeException('The template has no processed video yet');
        }
        $master = $this->ffmpeg->probe($this->private()->path($template->source_path));

        return $this->buildPreview($template, $template->source_rev, $template->source_path, $master, $template->watermark ?? []);
    }

    /** @return array{preview_path: string, poster_path: string} */
    private function buildPreview(BannerTemplate $template, int $rev, string $sourcePath, array $master, array $watermark): array
    {
        [$w, $h] = $this->previewSize($master['width'], $master['height']);

        // Unique names per build: previews are served with long cache headers
        $tag = $rev . '-' . Str::lower(Str::random(6));
        $dir = "banners/templates/{$template->uuid}";
        $previewPath = "{$dir}/preview-{$tag}.mp4";
        $posterPath = "{$dir}/poster-{$tag}.webp";

        $tmpDir = $this->private()->path('tmp/template-' . $template->uuid . '-' . Str::random(8));
        $wmFile = $tmpDir . '/watermark.png';

        try {
            $this->watermark->png(
                $w,
                $h,
                (string) ($watermark['text'] ?? config('banners.template.default_watermark.text')),
                (int) ($watermark['opacity'] ?? config('banners.template.default_watermark.opacity')),
                $wmFile
            );

            $this->ffmpeg->run(array_merge([
                '-i', $this->private()->path($sourcePath), '-i', $wmFile,
                '-filter_complex',
                "[0:v]scale={$w}:{$h}:flags=lanczos:in_color_matrix=bt709:out_color_matrix=bt709:in_range=tv:out_range=tv[v];"
                . '[v][1:v]overlay=0:0,format=yuv420p',
                '-an', '-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'high',
                '-crf', (string) config('banners.template.preview_crf', 26),
            ], self::BT709_TAGS, ['-movflags', '+faststart', '-f', 'mp4']), $this->public()->path($previewPath));

            $at = $master['duration'] > 1 ? '0.5' : '0';
            $this->ffmpeg->run([
                '-ss', $at, '-i', $this->public()->path($previewPath),
                '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88', '-f', 'webp',
            ], $this->public()->path($posterPath));
        } catch (\Throwable $e) {
            $this->public()->delete([$previewPath, $posterPath]);
            throw $e;
        } finally {
            @unlink($wmFile);
            @rmdir($tmpDir);
        }

        return ['preview_path' => $previewPath, 'poster_path' => $posterPath];
    }

    private function checkLimits(array $info): void
    {
        $limits = config('banners.template');
        if ($info['duration'] <= 0) {
            throw new \RuntimeException('Could not read the video duration');
        }
        if ($info['duration'] > $limits['max_duration']) {
            throw new \RuntimeException("The video is longer than {$limits['max_duration']} s");
        }
        if (max($info['width'], $info['height']) > $limits['max_side']) {
            throw new \RuntimeException("The video is larger than {$limits['max_side']} px on a side");
        }
        if ($info['fps'] > $limits['max_fps'] + 0.01) {
            throw new \RuntimeException("The video has more than {$limits['max_fps']} fps");
        }
    }

    public function canRemux(array $info): bool
    {
        return $info['codec'] === 'h264'
            && $info['pix_fmt'] === 'yuv420p'
            && $info['width'] % 2 === 0
            && $info['height'] % 2 === 0
            && in_array($info['color_space'], [null, 'bt709'], true)
            && $info['color_range'] !== 'pc';
    }

    private function masterFilter(array $info): string
    {
        $matrix = match ($info['color_space']) {
            'smpte170m', 'bt470bg', 'bt601' => 'bt601',
            default => 'bt709',
        };
        $range = ($info['color_range'] === 'pc' || str_starts_with($info['pix_fmt'], 'yuvj')) ? 'pc' : 'tv';

        // Odd sizes are cropped by one pixel instead of resampled
        return 'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0,'
            . "scale=in_color_matrix={$matrix}:out_color_matrix=bt709:in_range={$range}:out_range=tv,format=yuv420p";
    }

    /** Preview width ≤ configured width (never upscaled), aspect ratio kept, even sides for H.264. */
    public function previewSize(int $width, int $height): array
    {
        $w = min((int) config('banners.template.preview_width', 720), $width);
        $w -= $w % 2;
        $h = (int) round($height * $w / $width / 2) * 2; // nearest even height

        return [max(2, $w), max(2, $h)];
    }

    private function private()
    {
        return Storage::disk(config('banners.disks.private'));
    }

    private function public()
    {
        return Storage::disk(config('banners.disks.public'));
    }
}
