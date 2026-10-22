<?php

namespace App\Services\Banners;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Buyer logos. The real type is detected from the content (not the name or the browser's
 * MIME), size and pixel limits are checked from the header before decoding, and the image is
 * decoded and re-encoded with GD to PNG: metadata and anything appended to the file are gone.
 * SVG and every other type are rejected. Very large logos are scaled down to 2x the zone size.
 */
class BannerImageProcessor
{
    private const TYPES = [
        IMAGETYPE_PNG => 'image/png',
        IMAGETYPE_JPEG => 'image/jpeg',
        IMAGETYPE_WEBP => 'image/webp',
    ];

    /**
     * @param array $zone image zone from the snapshot config
     * @param int[] $templateSize [width, height] of the template video
     * @return array{path: string, width: int, height: int}
     * @throws ValidationException
     */
    public function process(UploadedFile $file, array $zone, array $templateSize, string $targetPath, string $field): array
    {
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
            $fail('Use a PNG, JPG or WebP image');
        }

        // Header only: dimensions are known before anything is decoded
        $info = @getimagesize($source);
        if (!$info || !isset(self::TYPES[$info[2]]) || self::TYPES[$info[2]] !== $mime) {
            $fail('The file is not a valid PNG, JPG or WebP image');
        }
        [$w, $h] = $info;
        if ($w < 1 || $h < 1 || $w > $limits['max_side'] || $h > $limits['max_side'] || $w * $h > $limits['max_pixels']) {
            $fail("The image is too large ({$w}×{$h}); up to {$limits['max_side']} px on a side");
        }

        $img = match ($info[2]) {
            IMAGETYPE_PNG => @imagecreatefrompng($source),
            IMAGETYPE_JPEG => @imagecreatefromjpeg($source),
            IMAGETYPE_WEBP => @imagecreatefromwebp($source),
        };
        if (!$img) {
            $fail('The image could not be read');
        }

        if ($info[2] === IMAGETYPE_JPEG) {
            $img = $this->applyExifOrientation($img, $source);
        }
        if (!imageistruecolor($img)) {
            imagepalettetotruecolor($img);
        }

        // No need to keep more pixels than twice the zone at the template's native size
        $boxW = max(1, $zone['w'] / 100 * $templateSize[0] * 2);
        $boxH = max(1, $zone['h'] / 100 * $templateSize[1] * 2);
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

        $stream = fopen($tmp, 'rb');
        Storage::disk(config('banners.disks.private'))->put($targetPath, $stream);
        fclose($stream);
        @unlink($tmp);

        return ['path' => $targetPath, 'width' => $outW, 'height' => $outH];
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
    private function applyExifOrientation(\GdImage $img, string $file): \GdImage
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
