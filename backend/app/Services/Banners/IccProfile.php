<?php

namespace App\Services\Banners;

/**
 * Reads the embedded ICC color profile of a PNG, JPEG or WebP file (without decoding pixels)
 * and tells whether the image is sRGB. GD ignores profiles: a Display P3 or Adobe RGB image would
 * silently change color when decoded as sRGB, so such uploads are rejected instead.
 *
 * Untagged images and RGB profiles with sRGB primaries (any vendor's sRGB, compact variants)
 * count as sRGB; so do grayscale profiles.
 */
class IccProfile
{
    private const MAX_PROFILE = 4 * 1024 * 1024;

    /** sRGB colorants in the profile connection space (D50), as in every sRGB profile */
    private const SRGB_COLORANTS = [
        'rXYZ' => [0.4361, 0.2225, 0.0139],
        'gXYZ' => [0.3851, 0.7169, 0.0971],
        'bXYZ' => [0.1431, 0.0606, 0.7141],
    ];

    /**
     * Null when the image is fine as sRGB, otherwise why not (for the admin).
     *
     * @param int $type IMAGETYPE_PNG | IMAGETYPE_JPEG | IMAGETYPE_WEBP
     */
    public static function problem(string $file, int $type): ?string
    {
        $data = @file_get_contents($file);
        if ($data === false) {
            return null;
        }
        $icc = match ($type) {
            IMAGETYPE_PNG => self::fromPng($data),
            IMAGETYPE_JPEG => self::fromJpeg($data),
            IMAGETYPE_WEBP => self::fromWebp($data),
            default => null,
        };
        if ($icc === null || strlen($icc) < 132) {
            return null;
        }

        $space = substr($icc, 16, 4);
        if ($space === 'GRAY') {
            return null;
        }
        if ($space !== 'RGB ') {
            return 'The image is in ' . trim($space) . ' color; export it as RGB (sRGB)';
        }
        if (self::hasSrgbColorants($icc)) {
            return null;
        }
        $name = self::description($icc);
        if ($name !== null && (stripos($name, 'srgb') !== false || str_contains($name, '61966'))) {
            return null;
        }

        return 'The image uses the "' . ($name ?? 'unknown') . '" color profile; convert it to sRGB before uploading';
    }

    // ─── Containers ──────────────────────────────────────────

    private static function fromPng(string $data): ?string
    {
        $pos = 8;
        $len = strlen($data);
        while ($pos + 8 <= $len) {
            $size = unpack('N', substr($data, $pos, 4))[1];
            $type = substr($data, $pos + 4, 4);
            if ($type === 'IDAT' || $type === 'IEND' || $size > $len) {
                return null; // iCCP must come before the image data
            }
            if ($type === 'iCCP') {
                $chunk = substr($data, $pos + 8, $size);
                $nul = strpos($chunk, "\0");
                if ($nul === false) {
                    return null;
                }
                $profile = @gzuncompress(substr($chunk, $nul + 2), self::MAX_PROFILE);
                return $profile === false ? null : $profile;
            }
            $pos += 12 + $size;
        }
        return null;
    }

    private static function fromJpeg(string $data): ?string
    {
        $parts = [];
        $pos = 2;
        $len = strlen($data);
        while ($pos + 4 <= $len && $data[$pos] === "\xFF") {
            $marker = ord($data[$pos + 1]);
            if ($marker === 0xD8 || ($marker >= 0xD0 && $marker <= 0xD7) || $marker === 0x01 || $marker === 0xFF) {
                $pos += $marker === 0xFF ? 1 : 2; // markers without a length (and fill bytes)
                continue;
            }
            if ($marker === 0xDA || $marker === 0xD9) {
                break; // image data: no more metadata
            }
            $size = unpack('n', substr($data, $pos + 2, 2))[1];
            if ($marker === 0xE2 && substr($data, $pos + 4, 12) === "ICC_PROFILE\0") {
                $parts[ord($data[$pos + 16])] = substr($data, $pos + 18, $size - 16);
            }
            $pos += 2 + $size;
        }
        if (!$parts) {
            return null;
        }
        ksort($parts);
        $profile = implode('', $parts);
        return strlen($profile) <= self::MAX_PROFILE ? $profile : null;
    }

    private static function fromWebp(string $data): ?string
    {
        if (substr($data, 0, 4) !== 'RIFF' || substr($data, 8, 4) !== 'WEBP') {
            return null;
        }
        $pos = 12;
        $len = strlen($data);
        while ($pos + 8 <= $len) {
            $type = substr($data, $pos, 4);
            $size = unpack('V', substr($data, $pos + 4, 4))[1];
            if ($type === 'ICCP') {
                return $size <= self::MAX_PROFILE ? substr($data, $pos + 8, $size) : null;
            }
            $pos += 8 + $size + ($size % 2);
        }
        return null;
    }

    // ─── Profile ─────────────────────────────────────────────

    /** @return array<string, array{int, int}> tag signature => [offset, size] */
    private static function tags(string $icc): array
    {
        $count = min(100, unpack('N', substr($icc, 128, 4))[1]);
        $tags = [];
        for ($i = 0; $i < $count; $i++) {
            $entry = substr($icc, 132 + $i * 12, 12);
            if (strlen($entry) < 12) {
                break;
            }
            $u = unpack('Noffset/Nsize', substr($entry, 4));
            $tags[substr($entry, 0, 4)] = [$u['offset'], $u['size']];
        }
        return $tags;
    }

    private static function hasSrgbColorants(string $icc): bool
    {
        $tags = self::tags($icc);
        foreach (self::SRGB_COLORANTS as $sig => $expected) {
            if (!isset($tags[$sig])) {
                return false;
            }
            $tag = substr($icc, $tags[$sig][0], 20);
            if (strlen($tag) < 20 || substr($tag, 0, 4) !== 'XYZ ') {
                return false;
            }
            foreach (array_values(unpack('N3', substr($tag, 8, 12))) as $i => $raw) {
                $value = ($raw >= 0x80000000 ? $raw - 0x100000000 : $raw) / 65536; // s15Fixed16
                if (abs($value - $expected[$i]) > 0.003) {
                    return false;
                }
            }
        }
        return true;
    }

    private static function description(string $icc): ?string
    {
        $tag = self::tags($icc)['desc'] ?? null;
        if (!$tag) {
            return null;
        }
        $data = substr($icc, $tag[0], min($tag[1], 4096));
        $type = substr($data, 0, 4);
        $text = null;
        if ($type === 'desc' && strlen($data) >= 12) {
            $n = unpack('N', substr($data, 8, 4))[1];
            $text = substr($data, 12, max(0, $n - 1));
        } elseif ($type === 'mluc' && strlen($data) >= 28) {
            ['l' => $length, 'o' => $offset] = unpack('Nl/No', substr($data, 20, 8));
            $text = @mb_convert_encoding(substr($data, $offset, $length), 'UTF-8', 'UTF-16BE');
        }
        $text = trim(preg_replace('/[^\P{C}]+/u', '', (string) $text) ?? '');

        return $text !== '' ? mb_substr($text, 0, 60) : null;
    }
}
