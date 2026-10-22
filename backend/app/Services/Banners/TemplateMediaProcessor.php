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
 * An uploaded PNG/JPG/WebP makes an image ("static") template instead: an opaque sRGB PNG
 * master (orientation applied, metadata dropped) and a watermarked WebP preview and poster.
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
    // Newer ffmpeg takes color metadata from the frames; without this the -color_* options
    // alone leave primaries/transfer "unknown" on encoded outputs
    private const SETPARAMS = 'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv';

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
        if (in_array((new \finfo(FILEINFO_MIME_TYPE))->file($upload), config('banners.template.image_mimes'), true)) {
            return $this->processImageUpload($template, $upload, $rev);
        }
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
            'kind' => BannerMedia::VIDEO,
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
        if ($template->isImage()) {
            return $this->buildImagePreview($template, $template->source_rev, $this->private()->path($template->source_path), $template->watermark ?? []);
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
                . '[v][1:v]overlay=0:0,format=yuv420p,' . self::SETPARAMS,
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

    // ─── Image templates ─────────────────────────────────────

    /** Opaque sRGB PNG master + watermarked WebP preview and poster from a PNG/JPG/WebP upload. */
    private function processImageUpload(BannerTemplate $template, string $upload, int $rev): array
    {
        $img = $this->decodeImage($upload);
        $sourcePath = "templates/{$template->uuid}/source-{$rev}-" . Str::lower(Str::random(6)) . '.png';
        $source = $this->private()->path($sourcePath);
        $width = imagesx($img);
        $height = imagesy($img);

        try {
            $this->writeImage($source, fn (string $tmp) => imagepng($img, $tmp, 6));
        } finally {
            imagedestroy($img);
        }

        try {
            $preview = $this->buildImagePreview($template, $rev, $source, $template->watermark ?? []);
        } catch (\Throwable $e) {
            $this->private()->delete($sourcePath);
            throw $e;
        }

        return array_merge($preview, [
            'kind' => BannerMedia::IMAGE,
            'source_rev' => $rev,
            'source_path' => $sourcePath,
            'width' => $width,
            'height' => $height,
            'fps' => null,
            'duration' => null,
            'frame_count' => null,
        ]);
    }

    /**
     * Checked from the header first (type, size, color profile), then decoded with GD: EXIF
     * orientation applied, transparency flattened onto black, everything but the pixels dropped.
     */
    private function decodeImage(string $file): \GdImage
    {
        $limits = config('banners.template');
        $types = [IMAGETYPE_PNG => 'image/png', IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_WEBP => 'image/webp'];
        $info = @getimagesize($file);
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file);
        if (!$info || ($types[$info[2]] ?? null) !== $mime) {
            throw new \RuntimeException('The file is not a valid PNG, JPG or WebP image');
        }
        [$w, $h] = $info;
        if (max($w, $h) > $limits['max_side'] || $w * $h > $limits['max_image_pixels']) {
            throw new \RuntimeException("The image is larger than {$limits['max_side']} px on a side");
        }
        if (min($w, $h) < 64) {
            throw new \RuntimeException('The image is smaller than 64 px on a side');
        }
        if ($problem = IccProfile::problem($file, $info[2])) {
            throw new \RuntimeException($problem);
        }

        // Two full-size truecolor copies at most (4 bytes per pixel each)
        $need = $w * $h * 4 * 2 + 64 * 1024 * 1024;
        $limit = $this->bytes((string) ini_get('memory_limit'));
        if ($limit > 0 && $limit < $need) {
            ini_set('memory_limit', (string) $need);
        }

        $img = match ($info[2]) {
            IMAGETYPE_PNG => @imagecreatefrompng($file),
            IMAGETYPE_JPEG => @imagecreatefromjpeg($file),
            IMAGETYPE_WEBP => @imagecreatefromwebp($file),
        };
        if (!$img) {
            throw new \RuntimeException('The image could not be read');
        }
        if ($info[2] === IMAGETYPE_JPEG) {
            $img = BannerImageProcessor::applyExifOrientation($img, $file);
        }

        // The background is opaque, like a video frame
        $flat = imagecreatetruecolor(imagesx($img), imagesy($img));
        imagefill($flat, 0, 0, imagecolorallocate($flat, 0, 0, 0));
        imagealphablending($flat, true);
        imagecopy($flat, $img, 0, 0, 0, 0, imagesx($img), imagesy($img));
        imagedestroy($img);

        return $flat;
    }

    /** @return array{preview_path: string, poster_path: string} */
    private function buildImagePreview(BannerTemplate $template, int $rev, string $source, array $watermark): array
    {
        $master = @imagecreatefrompng($source);
        if (!$master) {
            throw new \RuntimeException('The template image could not be read');
        }
        [$w, $h] = $this->previewSize(imagesx($master), imagesy($master));

        $tag = $rev . '-' . Str::lower(Str::random(6));
        $dir = "banners/templates/{$template->uuid}";
        $previewPath = "{$dir}/preview-{$tag}.webp";
        $posterPath = "{$dir}/poster-{$tag}.webp";
        $wmFile = $this->private()->path('tmp/template-' . $template->uuid . '-' . Str::random(8) . '/watermark.png');

        $img = imagecreatetruecolor($w, $h);
        try {
            imagecopyresampled($img, $master, 0, 0, 0, 0, $w, $h, imagesx($master), imagesy($master));

            $this->watermark->png(
                $w,
                $h,
                (string) ($watermark['text'] ?? config('banners.template.default_watermark.text')),
                (int) ($watermark['opacity'] ?? config('banners.template.default_watermark.opacity')),
                $wmFile
            );
            $mark = imagecreatefrompng($wmFile);
            imagealphablending($img, true);
            imagecopy($img, $mark, 0, 0, 0, 0, $w, $h);
            imagedestroy($mark);

            $this->writeImage($this->public()->path($previewPath), fn (string $tmp) => imagewebp($img, $tmp, 88));
            $this->writeImage($this->public()->path($posterPath), fn (string $tmp) => imagewebp($img, $tmp, 80));
        } catch (\Throwable $e) {
            $this->public()->delete([$previewPath, $posterPath]);
            throw $e;
        } finally {
            imagedestroy($master);
            imagedestroy($img);
            @unlink($wmFile);
            @rmdir(dirname($wmFile));
        }

        return ['preview_path' => $previewPath, 'poster_path' => $posterPath];
    }

    /** Write through a temp file so a failure never leaves a half-written file in place. */
    private function writeImage(string $target, callable $encode): void
    {
        if (!is_dir(dirname($target))) {
            mkdir(dirname($target), 0755, true);
        }
        $tmp = $target . '.tmp';
        if (!$encode($tmp) || !is_file($tmp) || filesize($tmp) === 0) {
            @unlink($tmp);
            throw new \RuntimeException('Could not write ' . basename($target));
        }
        rename($tmp, $target);
    }

    private function bytes(string $value): int
    {
        $value = trim($value);
        if ($value === '' || $value === '-1') {
            return -1;
        }
        $n = (int) $value;
        return match (strtolower(substr($value, -1))) {
            'g' => $n * 1024 ** 3,
            'm' => $n * 1024 ** 2,
            'k' => $n * 1024,
            default => $n,
        };
    }

    // ─── Video limits and sizes ──────────────────────────────

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
            . "scale=in_color_matrix={$matrix}:out_color_matrix=bt709:in_range={$range}:out_range=tv,format=yuv420p,"
            . self::SETPARAMS;
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
