<?php

namespace App\Services\Banners;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Buyer logos and icons. The real type is detected from the content (not the name or the
 * browser's MIME), size and pixel limits are checked from the header before decoding, and the
 * image is decoded and re-encoded with GD to PNG: metadata and anything appended to the file are
 * gone. SVG and every other type are rejected. Very large logos are scaled down to 2x the zone size.
 *
 * Animated GIFs stay animated: their structure is read first (canvas, frames, duration; see
 * GifInfo) and limited, then ffmpeg re-encodes them, scaled like other images, with a time limit.
 * The stored file is then image-<key>.gif instead of .png; the renderer composites it per frame.
 */
class BannerImageProcessor
{
    private const TYPES = [
        IMAGETYPE_PNG => 'image/png',
        IMAGETYPE_JPEG => 'image/jpeg',
        IMAGETYPE_WEBP => 'image/webp',
        IMAGETYPE_GIF => 'image/gif',
    ];

    private string $disk = 'banners';

    public function __construct(private ?Ffmpeg $ffmpeg = null)
    {
        $this->ffmpeg ??= new Ffmpeg();
    }

    /**
     * @param array $zone image zone from the snapshot config
     * @param int[] $templateSize [width, height] of the template video
     * @param string $targetBase disk path without the extension (.png, or .gif when animated)
     * @param string|null $disk where to store it: the private banners disk unless given (a
     *                          template's default images go to the public disk)
     * @return array{path: string, width: int, height: int, animated: bool}
     * @throws ValidationException
     */
    public function process(UploadedFile $file, array $zone, array $templateSize, string $targetBase, string $field, ?string $disk = null): array
    {
        $this->disk = $disk ?? config('banners.disks.private');
        $fail = fn (string $message) => throw ValidationException::withMessages([$field => [$message]]);
        $limits = config('banners.logo');

        if (!$file->isValid()) {
            $fail('The upload failed, please try again');
        }
        $maxBytes = min((int) $limits['max_kb'] * 1024, (int) ($zone['controls']['upload']['maxBytes'] ?? PHP_INT_MAX));
        if ($file->getSize() > $maxBytes) {
            $fail('The image is larger than ' . round($maxBytes / 1024 / 1024, 1) . ' MB');
        }

        $source = $file->getRealPath();
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($source);
        if (!in_array($mime, $limits['mimes'], true)) {
            $fail('Use a PNG, JPG, WebP or GIF image');
        }

        // Header only: dimensions are known before anything is decoded
        $info = @getimagesize($source);
        if (!$info || !isset(self::TYPES[$info[2]]) || self::TYPES[$info[2]] !== $mime) {
            $fail('The file is not a valid PNG, JPG, WebP or GIF image');
        }
        [$w, $h] = $info;
        if ($w < 1 || $h < 1 || $w > $limits['max_side'] || $h > $limits['max_side'] || $w * $h > $limits['max_pixels']) {
            $fail("The image is too large ({$w}×{$h}); up to {$limits['max_side']} px on a side");
        }

        // No need to keep more pixels than twice the zone at the template's native size
        $boxW = max(1, $zone['w'] / 100 * $templateSize[0] * 2);
        $boxH = max(1, $zone['h'] / 100 * $templateSize[1] * 2);

        if ($info[2] === IMAGETYPE_GIF) {
            try {
                $gif = GifInfo::read((string) file_get_contents($source), (int) $limits['gif']['max_frames']);
            } catch (\InvalidArgumentException) {
                $fail('The file is not a valid GIF image');
            }
            if ($gif['frames'] > 1) {
                return $this->animatedGif($source, $gif, $boxW, $boxH, $targetBase, $fail);
            }
        }

        $img = match ($info[2]) {
            IMAGETYPE_PNG => @imagecreatefrompng($source),
            IMAGETYPE_JPEG => @imagecreatefromjpeg($source),
            IMAGETYPE_WEBP => @imagecreatefromwebp($source),
            IMAGETYPE_GIF => @imagecreatefromgif($source),
        };
        if (!$img) {
            $fail('The image could not be read');
        }

        if ($info[2] === IMAGETYPE_JPEG) {
            $img = self::applyExifOrientation($img, $source);
        }
        if (!imageistruecolor($img)) {
            imagepalettetotruecolor($img);
        }

        $img = $this->fitInside($img, $boxW, $boxH);

        $tmp = tempnam(sys_get_temp_dir(), 'bnlogo');
        imagealphablending($img, false);
        imagesavealpha($img, true);
        $ok = imagepng($img, $tmp, 6);
        $outW = imagesx($img);
        $outH = imagesy($img);
        imagedestroy($img);
        if (!$ok) {
            @unlink($tmp);
            $fail('The image could not be processed');
        }

        $targetPath = $targetBase . '.png';
        $this->store($tmp, $targetPath);

        return ['path' => $targetPath, 'width' => $outW, 'height' => $outH, 'animated' => false];
    }

    /**
     * An animated GIF within the limits, re-encoded by ffmpeg (never stored as uploaded): forced
     * GIF demuxer, one pass through the frames, scaled to fit the box, one palette, original
     * frame timing, looping forever.
     */
    private function animatedGif(string $source, array $gif, float $boxW, float $boxH, string $targetBase, callable $fail): array
    {
        $limits = config('banners.logo.gif');
        if ($gif['more'] || $gif['frames'] > $limits['max_frames']) {
            $fail("The GIF has too many frames; up to {$limits['max_frames']}");
        }
        if ($gif['duration'] > $limits['max_duration']) {
            $fail("The GIF is too long; up to {$limits['max_duration']} seconds");
        }
        if (max($gif['width'], $gif['height']) > $limits['max_side']) {
            $fail("The animated GIF is too large ({$gif['width']}×{$gif['height']}); up to {$limits['max_side']} px on a side");
        }
        if ($gif['width'] * $gif['height'] * $gif['frames'] > $limits['max_total_pixels']) {
            $fail('The animated GIF is too heavy: use fewer frames or a smaller size');
        }

        $scale = min(1, $boxW / $gif['width'], $boxH / $gif['height']);
        $w = max(1, (int) round($gif['width'] * $scale));
        $h = max(1, (int) round($gif['height'] * $scale));

        $base = tempnam(sys_get_temp_dir(), 'bngif');
        $tmp = $base . '.gif';
        try {
            $this->ffmpeg->run([
                '-threads', '1', '-f', 'gif', '-i', $source,
                '-t', (string) ($limits['max_duration'] + 1),
                '-filter_complex',
                "[0:v]scale={$w}:{$h}:flags=lanczos,split[a][b];[a]palettegen=stats_mode=full:reserve_transparent=1[p];"
                . '[b][p]paletteuse=dither=bayer:bayer_scale=3:alpha_threshold=128',
                '-frames:v', (string) ($limits['max_frames'] + 1), '-fps_mode', 'passthrough',
                '-loop', '0', '-f', 'gif',
            ], $tmp, (int) $limits['timeout']);
            $out = GifInfo::read((string) file_get_contents($tmp), (int) $limits['max_frames']);
        } catch (\Throwable $e) {
            @unlink($tmp);
            Log::warning('Animated GIF rejected: ' . $e->getMessage());
            $fail('The GIF could not be processed');
        } finally {
            @unlink($base);
        }

        $targetPath = $targetBase . '.gif';
        $this->store($tmp, $targetPath);

        return ['path' => $targetPath, 'width' => $out['width'], 'height' => $out['height'], 'animated' => $out['frames'] > 1];
    }

    private function store(string $tmp, string $targetPath): void
    {
        $stream = fopen($tmp, 'rb');
        Storage::disk($this->disk)->put($targetPath, $stream);
        fclose($stream);
        @unlink($tmp);
    }

    private function fitInside(\GdImage $img, float $maxW, float $maxH): \GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        $scale = min(1, $maxW / $w, $maxH / $h);
        if ($scale >= 1) {
            return $img;
        }

        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));
        $dst = imagecreatetruecolor($nw, $nh);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127));
        imagecopyresampled($dst, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imagedestroy($img);

        return $dst;
    }

    /** Browsers show JPEGs rotated by their EXIF orientation; bake it in so the render matches. */
    public static function applyExifOrientation(\GdImage $img, string $file): \GdImage
    {
        if (!function_exists('exif_read_data')) {
            return $img;
        }
        $exif = @exif_read_data($file);
        $orientation = (int) ($exif['Orientation'] ?? 1);

        // Same order as Intervention Image's orientate(): rotate (counter-clockwise), then mirror
        $angle = match ($orientation) {
            3, 4 => 180,
            5, 6 => -90,
            7, 8 => 90,
            default => 0,
        };
        if ($angle !== 0) {
            $rotated = imagerotate($img, $angle, imagecolorallocatealpha($img, 0, 0, 0, 127));
            if ($rotated) {
                imagedestroy($img);
                $img = $rotated;
            }
        }
        if (in_array($orientation, [2, 4, 5, 7], true)) {
            imageflip($img, IMG_FLIP_HORIZONTAL);
        }
        return $img;
    }
}
