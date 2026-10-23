<?php

namespace App\Services\Banners;

use App\Models\BannerOrder;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

/**
 * Runs the Node renderer (renderer/src/render.mjs) for an order.
 *
 * Everything the renderer gets comes from the order snapshot: template config and master
 * video (or image), font files, the buyer's normalized params and re-encoded logos. Output is
 * written to a per-attempt temp folder, then moved to orders/<token>/banner.{mp4,gif} (video
 * templates) or banner.{png,jpg} (image templates) on the private disk.
 */
class BannerRenderer
{
    /**
     * @return array{mp4?: array{path: string, size: int}, gif?: array, png?: array, jpg?: array, hue: int, timings: array, fit: array}
     * @throws RenderFailed
     */
    public function render(BannerOrder $order): array
    {
        $private = Storage::disk(config('banners.disks.private'));
        $public = Storage::disk(config('banners.disks.public'));
        $snapshot = $order->snapshot;
        $media = $snapshot['media'] ?? [];
        $kind = BannerMedia::kindOf($snapshot);

        if (empty($media['source_path']) || !$private->exists($media['source_path'])) {
            throw new RenderFailed('The template ' . ($kind === BannerMedia::IMAGE ? 'image' : 'video') . ' for this order is missing');
        }

        $workRel = "tmp/{$order->token}-" . max(1, (int) $order->attempts);
        $private->deleteDirectory($workRel);
        $private->makeDirectory($workRel);
        $workDir = $private->path($workRel);

        try {
            $fonts = [];
            foreach ($snapshot['fonts'] ?? [] as $font) {
                if (!$public->exists($font['path'])) {
                    throw new RenderFailed("Font file is missing (font #{$font['id']})");
                }
                $fonts[] = ['id' => $font['id'], 'weight' => $font['weight'], 'style' => $font['style'], 'file' => $public->path($font['path'])];
            }

            $images = [];
            foreach ($order->images ?? [] as $key => $path) {
                if ($private->exists($path)) {
                    $images[$key] = $private->path($path);
                }
            }
            // The template's own images, where the buyer didn't upload one (the overlay still
            // hides an image the buyer removed)
            foreach ($snapshot['config']['zones'] ?? [] as $zone) {
                $default = $zone['style']['image'] ?? null;
                if (($zone['type'] ?? '') === 'image' && $default && !isset($images[$zone['key']]) && $public->exists($default)) {
                    $images[$zone['key']] = $public->path($default);
                }
            }

            $job = [
                'kind' => $kind,
                'width' => (int) $media['width'],
                'height' => (int) $media['height'],
                'duration' => (float) ($media['duration'] ?? 0),
                'config' => $snapshot['config'],
                'params' => $order->params,
                'source' => $private->path($media['source_path']),
                'fonts' => $fonts,
                'images' => (object) $images,
                'outputs' => $snapshot['outputs'] ?? ['mp4' => true],
                'workDir' => $workDir . DIRECTORY_SEPARATOR . 'out',
                'ffmpeg' => config('banners.render.ffmpeg_binary'),
                'threads' => (int) config('banners.render.threads', 3),
                'sandbox' => (bool) config('banners.render.chromium_sandbox', true),
            ];
            $jobFile = $workDir . DIRECTORY_SEPARATOR . 'job.json';
            file_put_contents($jobFile, json_encode($job, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

            $output = $this->run($jobFile, $workDir);

            return $this->collect($order, $output, $private, $kind);
        } finally {
            $private->deleteDirectory($workRel);
        }
    }

    /** @return array decoded result line from the renderer */
    private function run(string $jobFile, string $workDir): array
    {
        $env = ['HOME' => $workDir]; // Chromium wants a writable home; www-data's may not be
        if ($browsers = config('banners.render.browsers_path')) {
            $env['PLAYWRIGHT_BROWSERS_PATH'] = $browsers;
        }

        $process = Process::timeout((int) config('banners.render.timeout', 540))
            ->env($env)
            ->run([config('banners.render.node_binary', 'node'), config('banners.render.script'), $jobFile]);

        $stdout = trim($process->output());
        $lines = $stdout === '' ? [] : explode("\n", $stdout);
        $result = json_decode((string) end($lines), true);
        $log = trim("exit code: {$process->exitCode()}\n--- stderr ---\n" . mb_substr($process->errorOutput(), -15000) . "\n--- stdout ---\n" . mb_substr($stdout, -3000));

        if (!$process->successful() || !is_array($result) || ($result['ok'] ?? false) !== true) {
            $message = is_array($result) && !empty($result['error']) ? $result['error'] : 'The renderer stopped without a result';
            throw new RenderFailed('Render failed: ' . mb_substr((string) $message, 0, 500), $log);
        }

        return $result;
    }

    private function collect(BannerOrder $order, array $output, $private, string $kind): array
    {
        $result = [
            'hue' => $output['hue'] ?? null,
            'timings' => $output['timings'] ?? [],
            'fit' => $output['fit'] ?? [],
        ];

        foreach (BannerMedia::FORMATS as $format) {
            $target = "orders/{$order->token}/banner.{$format}";
            $file = $output[$format]['path'] ?? null;
            if (!$file) {
                $private->delete($target); // don't leave a GIF/JPG from an earlier render
                continue;
            }
            if (!is_file($file) || filesize($file) === 0) {
                throw new RenderFailed("The renderer reported a {$format} file that doesn't exist");
            }
            $dest = $private->path($target);
            if (!is_dir(dirname($dest))) {
                mkdir(dirname($dest), 0755, true);
            }
            if (!rename($file, $dest)) {
                throw new RenderFailed("Could not store the {$format} file");
            }
            $result[$format] = ['path' => $target, 'size' => filesize($dest)];
        }

        $primary = BannerMedia::primary($kind);
        if (empty($result[$primary])) {
            throw new RenderFailed('The renderer produced no ' . strtoupper($primary));
        }

        return $result;
    }
}
