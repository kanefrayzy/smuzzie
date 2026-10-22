<?php

namespace App\Services\Banners;

/**
 * Transparent PNG with a diagonal grid of text, burned into a template's public preview.
 * GD port of docs/banners/prototype/tools/watermark.py (same font, size, spacing, 28° angle);
 * opacity is configurable per template and defaults much lower than the prototype's 46/255.
 */
class WatermarkGenerator
{
    private const ANGLE = 28; // degrees, counter-clockwise like PIL's rotate()

    public function __construct(private ?string $fontFile = null)
    {
        $this->fontFile ??= resource_path('fonts/DejaVuSans-Bold.ttf');
    }

    /**
     * @param int $opacity 0 (invisible) .. 255 (opaque), same scale as the prototype's alpha
     */
    public function png(int $width, int $height, string $text, int $opacity, string $outPath): void
    {
        if ($width < 1 || $height < 1) {
            throw new \InvalidArgumentException('Watermark size must be positive');
        }
        $opacity = max(0, min(255, $opacity));
        $text = trim($text);

        $img = imagecreatetruecolor($width, $height);
        imagesavealpha($img, true);
        imagealphablending($img, false);
        imagefill($img, 0, 0, imagecolorallocatealpha($img, 0, 0, 0, 127));
        imagealphablending($img, true);

        if ($text !== '' && $opacity > 0) {
            $this->drawGrid($img, $width, $height, $text, $opacity);
        }

        $dir = dirname($outPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        if (!imagepng($img, $outPath)) {
            imagedestroy($img);
            throw new \RuntimeException('Could not write the watermark PNG');
        }
        imagedestroy($img);
    }

    private function drawGrid(\GdImage $img, int $w, int $h, string $text, int $opacity): void
    {
        // Prototype: pixel size max(14, w // 26). GD sizes are points at 96 dpi -> px * 0.75
        $px = max(14, intdiv($w, 26));
        $pt = $px * 0.75;
        // GD alpha: 0 = opaque, 127 = transparent
        $alpha = 127 - (int) round($opacity / 255 * 127);
        $color = imagecolorallocatealpha($img, 255, 255, 255, $alpha);

        $box = imagettfbbox($pt, 0, $this->fontFile, $text);
        if ($box === false) {
            throw new \RuntimeException('Could not read the watermark font');
        }
        $textW = abs($box[2] - $box[0]);
        $stepX = $textW + 80;
        $stepY = max(60, intdiv($w, 6));

        // Lay the grid out in rotated coordinates (u along the text, v across it),
        // centered on the image and large enough to cover it at any angle.
        $a = deg2rad(self::ANGLE);
        $ux = cos($a);
        $uy = -sin($a); // screen y grows downwards
        $vx = sin($a);
        $vy = cos($a);
        $cx = $w / 2;
        $cy = $h / 2;
        $reach = (int) ceil(sqrt($w * $w + $h * $h) / 2) + $stepX;

        $row = 0;
        for ($v = -$reach; $v <= $reach; $v += $stepY, $row++) {
            $offset = ($row % 2) * ($textW / 2 + 40);
            for ($u = -$reach - $stepX + $offset; $u <= $reach; $u += $stepX) {
                $x = $cx + $u * $ux + $v * $vx;
                $y = $cy + $u * $uy + $v * $vy;
                imagettftext($img, $pt, self::ANGLE, (int) round($x), (int) round($y), $color, $this->fontFile, $text);
            }
        }
    }
}
