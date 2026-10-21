<?php

namespace App\Services;

use App\Models\PortfolioItem;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Builds web-optimized derivatives of portfolio media with FFmpeg.
 * Originals are never modified; they stay available for zoom / download.
 *
 *  - Images: WebP at 640 / 1280 / 1920 px wide (never upscaled), aspect ratio kept,
 *    served to the browser through srcset.
 *  - Videos & GIFs: H.264 MP4 (plays everywhere incl. older iPhones that can't play WebM),
 *    a ≤720 px preview for the grid and a ≤1920 px version for the lightbox,
 *    plus a WebP poster frame.
 *
 * Quality settings were picked by comparing against the originals at 2× zoom:
 * WebP q88 keeps saturated red edges and paper textures intact (q80 visibly softens them);
 * x264 CRF 20 gives SSIM ≈ 0.98 vs the source; GIFs use CRF 17 + tune=animation for flat colors.
 */
class MediaOptimizer
{
    public const VERSION = 1;

    private const IMAGE_WIDTHS = [640, 1280, 1920];
    private const WEBP_QUALITY = 88;

    private const VIDEO_PREVIEW_MAX_W = 720;
    private const VIDEO_FULL_MAX_W = 1920;
    private const VIDEO_MAX_H = 4096; // keeps very tall clips inside hardware decoder limits
    private const VIDEO_CRF = 20;
    private const GIF_CRF = 17;

    private const VARIANTS_DIR = 'variants';

    public function __construct(private string $disk = 'public')
    {
    }

    /**
     * Generate variants for the item and save them on the model.
     * Returns false if processing failed; variants are then cleared and
     * the site keeps serving the original file.
     */
    public function process(PortfolioItem $item): bool
    {
        if (!$item->local_path || !$this->storage()->exists($item->local_path)) {
            Log::warning("MediaOptimizer: source missing for portfolio item #{$item->id}");
            return false;
        }

        @set_time_limit(0);

        // Drop old derivatives first so a re-run never leaves stale files behind
        $this->deleteVariants($item->local_path);

        try {
            $variants = match ($item->file_type) {
                'video', 'gif' => $this->processAnimated($item),
                default => $this->processImage($item),
            };
        } catch (\Throwable $e) {
            Log::error("MediaOptimizer: item #{$item->id} failed: {$e->getMessage()}");
            $this->deleteVariants($item->local_path);
            // Old variant files are gone, so make the site fall back to the original
            if ($item->variants !== null) {
                $item->update(['variants' => null]);
            }
            return false;
        }

        $update = ['variants' => $variants];
        // Videos were stored without dimensions; the frontend needs them to reserve space
        if (!$item->width || !$item->height) {
            $update['width'] = $variants['width'];
            $update['height'] = $variants['height'];
        }
        $item->update($update);

        return true;
    }

    /**
     * Remove every derivative generated for a source file (variants/<uuid>_*).
     */
    public function deleteVariants(string $sourcePath): void
    {
        $info = pathinfo($sourcePath);
        $pattern = $this->storage()->path($info['dirname'] . '/' . self::VARIANTS_DIR . '/' . $info['filename'] . '_*');
        foreach (glob($pattern) ?: [] as $file) {
            @unlink($file);
        }
    }

    // ─── Images ────────────────────────────────────────────────

    private function processImage(PortfolioItem $item): array
    {
        $source = $this->storage()->path($item->local_path);
        [$srcW, $srcH] = $this->imageSize($source);

        $widths = array_values(array_filter(self::IMAGE_WIDTHS, fn ($w) => $w < $srcW));
        if ($srcW <= max(self::IMAGE_WIDTHS)) {
            $widths[] = $srcW; // full-resolution WebP instead of an upscaled one
        }

        $images = [];
        foreach ($widths as $w) {
            $h = (int) round($srcH * $w / $srcW);
            $path = $this->variantPath($item->local_path, "{$w}.webp");
            $this->ffmpeg([
                '-i', $source,
                '-vf', "scale={$w}:-1:flags=lanczos,format=bgra",
                '-frames:v', '1',
                '-c:v', 'libwebp', '-quality', (string) self::WEBP_QUALITY, '-preset', 'picture',
                '-f', 'webp',
            ], $path);
            $images[] = ['w' => $w, 'h' => $h, 'url' => $this->url($path)];
        }

        return [
            'v' => self::VERSION,
            'width' => $srcW,
            'height' => $srcH,
            'images' => $images,
        ];
    }

    private function imageSize(string $file): array
    {
        $size = @getimagesize($file);
        if ($size && $size[0] > 0 && $size[1] > 0) {
            return [$size[0], $size[1]];
        }
        return $this->probeSize($file);
    }

    // ─── Videos & GIFs ─────────────────────────────────────────

    private function processAnimated(PortfolioItem $item): array
    {
        $source = $this->storage()->path($item->local_path);
        $isGif = $item->file_type === 'gif';
        [$srcW, $srcH] = $this->probeSize($source);

        $previewPath = $this->variantPath($item->local_path, 'preview.mp4');
        $this->encodeMp4($source, $previewPath, self::VIDEO_PREVIEW_MAX_W, $isGif);

        // Separate lightbox version only when the source is bigger than the preview
        $fullPath = $previewPath;
        if ($srcW > self::VIDEO_PREVIEW_MAX_W) {
            $fullPath = $this->variantPath($item->local_path, 'full.mp4');
            $this->encodeMp4($source, $fullPath, self::VIDEO_FULL_MAX_W, $isGif);
        }

        $posterPath = $this->variantPath($item->local_path, 'poster.webp');
        $this->encodePoster($source, $posterPath, $isGif);

        return [
            'v' => self::VERSION,
            'width' => $srcW,
            'height' => $srcH,
            'video' => [
                'preview' => $this->url($previewPath),
                'full' => $this->url($fullPath),
            ],
            'poster' => $this->url($posterPath),
        ];
    }

    private function scaleFilter(int $maxW): string
    {
        // Fit inside maxW × VIDEO_MAX_H without upscaling, then force even dimensions for H.264
        $maxH = self::VIDEO_MAX_H;
        return "scale=w='min({$maxW},iw)':h='min({$maxH},ih)':force_original_aspect_ratio=decrease:flags=lanczos,"
            . 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
    }

    private function encodeMp4(string $source, string $target, int $maxW, bool $isGif): void
    {
        $args = [
            '-i', $source,
            '-an',
            '-vf', $this->scaleFilter($maxW) . ',format=yuv420p',
            '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high',
            '-crf', (string) ($isGif ? self::GIF_CRF : self::VIDEO_CRF),
        ];
        if ($isGif) {
            array_push($args, '-tune', 'animation');
        }
        array_push($args, '-movflags', '+faststart', '-f', 'mp4');

        $this->ffmpeg($args, $target);
    }

    private function encodePoster(string $source, string $target, bool $isGif): void
    {
        $filter = $this->scaleFilter(self::VIDEO_PREVIEW_MAX_W) . ',format=bgra';
        $base = ['-frames:v', '1', '-vf', $filter, '-c:v', 'libwebp', '-quality', (string) self::WEBP_QUALITY, '-f', 'webp'];

        // Same frame the old JPG thumbnails used (0.5 s), first frame for GIFs / very short clips
        if (!$isGif) {
            try {
                $this->ffmpeg(array_merge(['-ss', '0.5', '-i', $source], $base), $target);
                return;
            } catch (\RuntimeException $e) {
                // clip shorter than 0.5 s — fall through to the first frame
            }
        }
        $this->ffmpeg(array_merge(['-i', $source], $base), $target);
    }

    private function probeSize(string $file): array
    {
        $cmd = 'ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x '
            . escapeshellarg($file) . ' 2>&1';
        exec($cmd, $out, $code);
        if ($code === 0 && preg_match('/^(\d+)x(\d+)/', trim($out[0] ?? ''), $m)) {
            return [(int) $m[1], (int) $m[2]];
        }
        throw new \RuntimeException('ffprobe could not read dimensions: ' . implode(' ', $out));
    }

    // ─── Helpers ───────────────────────────────────────────────

    /**
     * Run ffmpeg writing to a temp file, then move it into place,
     * so a failed or interrupted run never leaves a broken file at the public URL.
     */
    private function ffmpeg(array $args, string $targetPath): void
    {
        $target = $this->storage()->path($targetPath);
        $dir = dirname($target);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $tmp = $target . '.tmp';

        $cmd = 'ffmpeg -nostdin -v error -y '
            . implode(' ', array_map('escapeshellarg', $args))
            . ' ' . escapeshellarg($tmp) . ' 2>&1';
        exec($cmd, $out, $code);

        if ($code !== 0 || !is_file($tmp) || filesize($tmp) === 0) {
            @unlink($tmp);
            throw new \RuntimeException("ffmpeg failed (code {$code}) for {$targetPath}: " . implode(' ', array_slice($out, -5)));
        }
        rename($tmp, $target);
    }

    private function variantPath(string $sourcePath, string $suffix): string
    {
        $info = pathinfo($sourcePath);
        return $info['dirname'] . '/' . self::VARIANTS_DIR . '/' . $info['filename'] . '_' . $suffix;
    }

    private function url(string $path): string
    {
        return $this->storage()->url($path);
    }

    private function storage()
    {
        return Storage::disk($this->disk);
    }
}
