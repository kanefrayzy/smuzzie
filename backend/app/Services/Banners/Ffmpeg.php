<?php

namespace App\Services\Banners;

use Illuminate\Support\Facades\Process;

/**
 * Thin ffmpeg/ffprobe wrapper for the banner pipeline. Commands are passed as argument
 * arrays (no shell), every run has a timeout, and outputs are written to a temp file and
 * moved into place only on success, so a failed run never leaves a broken file behind.
 */
class Ffmpeg
{
    private string $ffmpeg;
    private string $ffprobe;

    public function __construct()
    {
        $this->ffmpeg = (string) config('banners.render.ffmpeg_binary', 'ffmpeg');
        $this->ffprobe = (string) config('banners.render.ffprobe_binary', 'ffprobe');
    }

    /**
     * Facts about the first video stream.
     *
     * @return array{codec: string, pix_fmt: string, width: int, height: int, fps: float,
     *               duration: float, frames: int, color_space: ?string, color_range: ?string}
     */
    public function probe(string $file): array
    {
        $result = Process::timeout(60)->run([
            $this->ffprobe, '-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name,pix_fmt,width,height,r_frame_rate,avg_frame_rate,nb_frames,duration,color_space,color_range:format=duration',
            '-of', 'json', $file,
        ]);
        if (!$result->successful()) {
            throw new \RuntimeException('ffprobe failed: ' . $this->tail($result->errorOutput()));
        }

        $json = json_decode($result->output(), true);
        $stream = $json['streams'][0] ?? null;
        if (!$stream || empty($stream['width']) || empty($stream['height'])) {
            throw new \RuntimeException('The file has no video stream');
        }

        $fps = $this->rate($stream['avg_frame_rate'] ?? '') ?: $this->rate($stream['r_frame_rate'] ?? '');
        $duration = (float) ($stream['duration'] ?? $json['format']['duration'] ?? 0);
        $frames = (int) ($stream['nb_frames'] ?? 0);
        if ($frames <= 0 && $fps > 0) {
            $frames = (int) round($duration * $fps);
        }

        return [
            'codec' => (string) ($stream['codec_name'] ?? ''),
            'pix_fmt' => (string) ($stream['pix_fmt'] ?? ''),
            'width' => (int) $stream['width'],
            'height' => (int) $stream['height'],
            'fps' => round($fps, 3),
            'duration' => round($duration, 3),
            'frames' => $frames,
            'color_space' => $this->known($stream['color_space'] ?? null),
            'color_range' => $this->known($stream['color_range'] ?? null),
        ];
    }

    /**
     * Run ffmpeg with the given arguments; the output path is appended as the last argument.
     * Callers pass an explicit "-f <format>" because the temp file has no usable extension.
     */
    public function run(array $args, string $target, int $timeout = 900): void
    {
        $dir = dirname($target);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $tmp = $target . '.tmp';

        $result = Process::timeout($timeout)->run(array_merge(
            [$this->ffmpeg, '-nostdin', '-v', 'error', '-y'],
            $args,
            [$tmp]
        ));

        if (!$result->successful() || !is_file($tmp) || filesize($tmp) === 0) {
            @unlink($tmp);
            throw new \RuntimeException('ffmpeg failed: ' . $this->tail($result->errorOutput() ?: $result->output()));
        }
        rename($tmp, $target);
    }

    private function rate(string $value): float
    {
        if (preg_match('#^(\d+)/(\d+)$#', $value, $m) && (int) $m[2] > 0) {
            return (int) $m[1] / (int) $m[2];
        }
        return is_numeric($value) ? (float) $value : 0.0;
    }

    private function known(?string $value): ?string
    {
        return ($value === null || $value === '' || $value === 'unknown') ? null : $value;
    }

    private function tail(string $text): string
    {
        $lines = array_filter(array_map('trim', explode("\n", $text)));
        return mb_substr(implode(' | ', array_slice($lines, -5)), 0, 1000);
    }
}
