<?php

namespace App\Services\Banners;

/**
 * Reads the structure of a GIF without decoding any pixels: canvas size, number of frames and
 * the total duration as browsers play it (delays under 20 ms count as 100 ms). Used to refuse
 * GIF "bombs" (huge canvases, thousands of frames) before ffmpeg ever touches the file.
 */
class GifInfo
{
    /**
     * @param int $maxFrames parsing stops once more frames than this were seen (the result says so)
     * @return array{width: int, height: int, frames: int, duration: float, more: bool}
     * @throws \InvalidArgumentException when the file is not a well-formed GIF
     */
    public static function read(string $data, int $maxFrames = 1000): array
    {
        $len = strlen($data);
        if ($len < 13 || !in_array(substr($data, 0, 6), ['GIF87a', 'GIF89a'], true)) {
            throw new \InvalidArgumentException('Not a GIF');
        }
        ['w' => $width, 'h' => $height, 'p' => $packed] = unpack('vw/vh/Cp', substr($data, 6, 5));
        if ($width < 1 || $height < 1) {
            throw new \InvalidArgumentException('Empty GIF canvas');
        }
        $pos = 13 + (($packed & 0x80) ? 3 * (2 << ($packed & 7)) : 0);

        $frames = 0;
        $centis = 0;
        $delay = 0;
        while ($pos < $len) {
            $byte = ord($data[$pos++]);
            if ($byte === 0x3B) {
                break; // trailer
            }
            if ($byte === 0x21) {
                if ($pos >= $len) {
                    break;
                }
                $label = ord($data[$pos++]);
                if ($label === 0xF9 && $pos + 5 <= $len && ord($data[$pos]) === 4) {
                    $delay = unpack('v', substr($data, $pos + 2, 2))[1];
                }
                $pos = self::skipSubBlocks($data, $pos);
                continue;
            }
            if ($byte !== 0x2C || $pos + 9 > $len) {
                throw new \InvalidArgumentException('Malformed GIF');
            }
            ['x' => $x, 'y' => $y, 'w' => $w, 'h' => $h, 'p' => $fp] = unpack('vx/vy/vw/vh/Cp', substr($data, $pos, 9));
            if ($w < 1 || $h < 1 || $x + $w > $width || $y + $h > $height) {
                throw new \InvalidArgumentException('A GIF frame lies outside the canvas');
            }
            $pos += 9 + (($fp & 0x80) ? 3 * (2 << ($fp & 7)) : 0) + 1; // local palette, LZW code size
            $pos = self::skipSubBlocks($data, $pos);

            $frames++;
            $centis += $delay < 2 ? 10 : $delay;
            $delay = 0;
            if ($frames > $maxFrames) {
                return ['width' => $width, 'height' => $height, 'frames' => $frames, 'duration' => $centis / 100, 'more' => true];
            }
        }
        if ($frames === 0) {
            throw new \InvalidArgumentException('The GIF has no frames');
        }

        return ['width' => $width, 'height' => $height, 'frames' => $frames, 'duration' => $centis / 100, 'more' => false];
    }

    /** Position after a chain of data sub-blocks (a zero length ends it). */
    private static function skipSubBlocks(string $data, int $pos): int
    {
        $len = strlen($data);
        while ($pos < $len) {
            $size = ord($data[$pos]);
            $pos += 1 + $size;
            if ($size === 0) {
                return $pos;
            }
        }
        return $len; // truncated file: browsers show what is there, so do we
    }
}
