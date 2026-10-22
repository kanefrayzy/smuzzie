<?php

namespace App\Services\Banners;

use Illuminate\Validation\ValidationException;

/**
 * Validates what a buyer sent against the template config from the order snapshot and returns
 * the normalized params that will be stored and rendered (format: docs/banners/PLAN.md §2).
 *
 *  - keys that aren't zones of the template, and values of controls the template switched off,
 *    are silently dropped (the renderer then uses the template default);
 *  - an invalid value for an enabled control is a 422: too long, out of range, bad color, etc.
 *
 * The frontend applies the same rules (banner-overlay/resolve.ts) but is never trusted.
 */
class BannerParamsValidator
{
    private const EPS = 1e-6;

    /** @var array<string, string[]> */
    private array $errors = [];

    /**
     * @throws ValidationException
     */
    public function validate(array $config, mixed $raw): array
    {
        $this->errors = [];
        if (!is_array($raw)) {
            throw ValidationException::withMessages(['params' => ['Invalid banner settings']]);
        }

        $out = ['schemaVersion' => 1, 'hue' => (int) ($config['hue']['default'] ?? 0), 'zones' => []];

        if (($config['hue']['enabled'] ?? false) && array_key_exists('hue', $raw)) {
            $hue = $raw['hue'];
            if (!is_int($hue) && !(is_string($hue) && ctype_digit($hue))) {
                $this->fail('params.hue', 'Hue must be a whole number');
            } elseif ((int) $hue < 0 || (int) $hue > 359) {
                $this->fail('params.hue', 'Hue must be between 0 and 359');
            } else {
                $out['hue'] = (int) $hue;
            }
        }

        $zones = $raw['zones'] ?? [];
        if (!is_array($zones)) {
            $this->fail('params.zones', 'Invalid zones');
            $zones = [];
        }

        foreach ($config['zones'] ?? [] as $zone) {
            $key = $zone['key'];
            if (!array_key_exists($key, $zones)) {
                continue;
            }
            $p = $zones[$key];
            if (!is_array($p)) {
                $this->fail("params.zones.{$key}", 'Invalid value');
                continue;
            }
            $normalized = $zone['type'] === 'text'
                ? $this->textZone($zone, $p, "params.zones.{$key}")
                : $this->imageZone($zone, $p, "params.zones.{$key}");
            if ($normalized) {
                $out['zones'][$key] = $normalized;
            }
        }

        if ($this->errors) {
            throw ValidationException::withMessages($this->errors);
        }

        return $out;
    }

    private function textZone(array $zone, array $p, string $path): array
    {
        $c = $zone['controls'];
        $style = $zone['style'];
        $out = [];

        if ($c['text']['enabled'] && array_key_exists('text', $p)) {
            if (!is_string($p['text'])) {
                $this->fail("{$path}.text", 'Text must be a string');
            } else {
                $multiline = (bool) $c['text']['multiline'];
                if (!$multiline && preg_match('/[\r\n]/', $p['text'])) {
                    $this->fail("{$path}.text", 'Line breaks are not allowed in this field');
                }
                $text = BannerConfigValidator::cleanText($p['text'], $multiline);
                $max = min((int) $c['text']['maxLength'], (int) config('banners.text.max_length', 200));
                if (mb_strlen($text) > $max) {
                    $this->fail("{$path}.text", "At most {$max} characters");
                }
                $out['text'] = $text;
            }
        }

        if ($c['size']['enabled'] && array_key_exists('size', $p)) {
            $size = $p['size'];
            if (!is_int($size) && !is_float($size) || !is_finite((float) $size)) {
                $this->fail("{$path}.size", 'Size must be a number');
            } elseif ($size < $c['size']['min'] - self::EPS || $size > $c['size']['max'] + self::EPS) {
                $this->fail("{$path}.size", "Size must be between {$c['size']['min']} and {$c['size']['max']}");
            } else {
                $out['size'] = round((float) $size, 3);
            }
        }

        if ($c['color']['enabled'] && array_key_exists('color', $p)) {
            $color = is_string($p['color']) ? strtolower($p['color']) : null;
            if ($color === null || !preg_match('/^#[0-9a-f]{6}$/', $color)) {
                $this->fail("{$path}.color", 'Color must look like #rrggbb');
            } elseif (!$c['color']['custom'] && $color !== $style['color'] && !in_array($color, $c['color']['palette'], true)) {
                $this->fail("{$path}.color", 'Pick a color from the palette');
            } else {
                $out['color'] = $color;
            }
        }

        if ($c['align']['enabled'] && array_key_exists('align', $p)) {
            if (!in_array($p['align'], $c['align']['options'], true)) {
                $this->fail("{$path}.align", 'Alignment is not allowed');
            } else {
                $out['align'] = $p['align'];
            }
        }

        if ($c['visible']['enabled'] && array_key_exists('visible', $p)) {
            if (!is_bool($p['visible'])) {
                $this->fail("{$path}.visible", 'Visibility must be true or false');
            } else {
                $out['visible'] = $p['visible'];
            }
        }

        // Blocks below were added later: snapshots of older orders don't have them (= off)
        if (($c['font']['enabled'] ?? false) && array_key_exists('fontId', $p)) {
            if (!is_int($p['fontId']) || !in_array($p['fontId'], $c['font']['options'], true)) {
                $this->fail("{$path}.fontId", 'This font is not available');
            } else {
                $out['fontId'] = $p['fontId'];
            }
        }

        if (($c['case']['enabled'] ?? false) && array_key_exists('case', $p)) {
            if (!in_array($p['case'], $c['case']['options'], true)) {
                $this->fail("{$path}.case", 'Letter case is not allowed');
            } else {
                $out['case'] = $p['case'];
            }
        }

        foreach (['letterSpacing' => 3, 'lineHeight' => 2, 'opacity' => 0] as $field => $decimals) {
            if (!($c[$field]['enabled'] ?? false) || !array_key_exists($field, $p)) {
                continue;
            }
            $value = $this->rangeValue($c[$field], $p[$field], "{$path}.{$field}");
            if ($value !== null) {
                $out[$field] = $decimals === 0 ? (int) round($value) : round($value, $decimals);
            }
        }

        if (($c['glow']['enabled'] ?? false) && array_key_exists('glow', $p)) {
            if (!is_bool($p['glow'])) {
                $this->fail("{$path}.glow", 'Glow must be true or false');
            } else {
                $out['glow'] = $p['glow'];
            }
        }

        return $out;
    }

    private function rangeValue(array $ctl, mixed $value, string $path): ?float
    {
        if (!is_int($value) && !is_float($value) || !is_finite((float) $value)) {
            $this->fail($path, 'Must be a number');
            return null;
        }
        if ($value < $ctl['min'] - self::EPS || $value > $ctl['max'] + self::EPS) {
            $this->fail($path, "Must be between {$ctl['min']} and {$ctl['max']}");
            return null;
        }
        return (float) $value;
    }

    private function imageZone(array $zone, array $p, string $path): array
    {
        $c = $zone['controls'];
        $out = [];

        if ($c['scale']['enabled'] && array_key_exists('scale', $p)) {
            $scale = $p['scale'];
            if (!is_int($scale) && !(is_float($scale) && floor($scale) === $scale)) {
                $this->fail("{$path}.scale", 'Size must be a whole number');
            } elseif ($scale < $c['scale']['min'] || $scale > $c['scale']['max']) {
                $this->fail("{$path}.scale", "Size must be between {$c['scale']['min']} and {$c['scale']['max']}");
            } else {
                $out['scale'] = (int) $scale;
            }
        }

        if ($c['align']['enabled']) {
            foreach (['alignX' => 'x', 'alignY' => 'y'] as $field => $axis) {
                if (!array_key_exists($field, $p)) {
                    continue;
                }
                if (!in_array($p[$field], $c['align'][$axis], true)) {
                    $this->fail("{$path}.{$field}", 'Alignment is not allowed');
                } else {
                    $out[$field] = $p[$field];
                }
            }
        }

        return $out;
    }

    private function fail(string $path, string $message): void
    {
        $this->errors[$path][] = $message;
    }
}
