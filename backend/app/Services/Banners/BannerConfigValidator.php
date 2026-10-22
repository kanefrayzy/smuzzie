<?php

namespace App\Services\Banners;

use App\Models\BannerFont;
use Illuminate\Validation\ValidationException;

/**
 * Validates and normalizes a template config written by the admin (format: docs/banners/PLAN.md §2).
 * The result is canonical: every zone has every style field and every control block,
 * numbers are rounded, unknown keys are dropped. Buyer input is validated against this later,
 * so anything accepted here must be safe for the editor and the renderer.
 *
 * Also normalizes the template's `outputs` and `watermark` settings.
 */
class BannerConfigValidator
{
    public const ALIGN = ['left', 'center', 'right'];
    public const ALIGN_Y = ['top', 'center', 'bottom'];
    public const CASES = ['none', 'upper', 'lower'];
    private const KEY_PATTERN = '/^[a-z][a-z0-9_]{0,31}$/';
    private const HEX_PATTERN = '/^#[0-9a-f]{6}$/';
    public const MAX_FONT_OPTIONS = 12;

    /** @var array<string, string[]> */
    private array $errors = [];

    /**
     * @throws ValidationException
     */
    public function validate(mixed $config): array
    {
        $this->errors = [];
        $config = is_array($config) ? $config : [];
        $limits = config('banners.template');

        $out = [
            'schemaVersion' => (int) config('banners.schema_version', 1),
            'accent' => $this->hex($config['accent'] ?? '#ff2d3d', 'config.accent'),
            'hue' => $this->hue($config['hue'] ?? [], 'config.hue'),
            'zones' => [],
        ];
        if (isset($config['schemaVersion']) && (int) $config['schemaVersion'] !== $out['schemaVersion']) {
            $this->fail('config.schemaVersion', "Unsupported schema version, expected {$out['schemaVersion']}");
        }

        $zones = $config['zones'] ?? [];
        if (!is_array($zones) || !array_is_list($zones)) {
            $this->fail('config.zones', 'Zones must be a list');
            $zones = [];
        }
        if (count($zones) > $limits['max_zones']) {
            $this->fail('config.zones', "At most {$limits['max_zones']} zones");
        }

        $fontIds = $this->availableFontIds($zones);
        $keys = [];
        $images = 0;
        foreach (array_slice($zones, 0, $limits['max_zones']) as $i => $zone) {
            $path = "config.zones.{$i}";
            if (!is_array($zone)) {
                $this->fail($path, 'Invalid zone');
                continue;
            }
            $key = (string) ($zone['key'] ?? '');
            if (!preg_match(self::KEY_PATTERN, $key)) {
                $this->fail("{$path}.key", 'Key: lowercase latin letters, digits and _, starting with a letter, up to 32 chars');
            } elseif (isset($keys[$key])) {
                $this->fail("{$path}.key", "Duplicate key \"{$key}\"");
            }
            $keys[$key] = true;

            $type = $zone['type'] ?? null;
            if ($type === 'image') {
                $images++;
            }
            $out['zones'][] = match ($type) {
                'text' => $this->textZone($zone, $path, $fontIds),
                'image' => $this->imageZone($zone, $path),
                default => $this->fail("{$path}.type", 'Type must be text or image') ?? [],
            };
        }
        if ($images > $limits['max_image_zones']) {
            $this->fail('config.zones', "At most {$limits['max_image_zones']} image zones");
        }

        $this->throwIfFailed();

        return $out;
    }

    /** @throws ValidationException */
    public function validateOutputs(mixed $outputs, ?int $templateWidth = null): array
    {
        $this->errors = [];
        $outputs = is_array($outputs) ? $outputs : [];
        $defaults = config('banners.template.default_outputs');
        $gif = is_array($outputs['gif'] ?? null) ? $outputs['gif'] : [];

        $maxWidth = $templateWidth ? min(1080, $templateWidth) : 1080;
        $out = [
            'mp4' => true, // always produced
            'gif' => [
                'enabled' => $this->bool($gif['enabled'] ?? $defaults['gif']['enabled']),
                'width' => (int) $this->number($gif['width'] ?? $defaults['gif']['width'], 'outputs.gif.width', 120, $maxWidth, 0),
                'fps' => (int) $this->number($gif['fps'] ?? $defaults['gif']['fps'], 'outputs.gif.fps', 5, 30, 0),
            ],
        ];
        $this->throwIfFailed();

        return $out;
    }

    /** @throws ValidationException */
    public function validateWatermark(mixed $watermark): array
    {
        $this->errors = [];
        $watermark = is_array($watermark) ? $watermark : [];
        $defaults = config('banners.template.default_watermark');

        $text = $this->cleanText((string) ($watermark['text'] ?? $defaults['text']), false);
        if ($text === '' || mb_strlen($text) > 40) {
            $this->fail('watermark.text', 'Watermark text: 1 to 40 characters');
        }
        $out = [
            'text' => $text,
            'opacity' => (int) $this->number($watermark['opacity'] ?? $defaults['opacity'], 'watermark.opacity', 0, 255, 0),
        ];
        $this->throwIfFailed();

        return $out;
    }

    /** Strip control characters (keeping newlines when allowed) and normalize to NFC. */
    public static function cleanText(string $text, bool $multiline): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace($multiline ? '/[^\P{C}\n]/u' : '/\p{C}/u', '', $text) ?? '';
        if (class_exists(\Normalizer::class)) {
            $text = \Normalizer::normalize($text, \Normalizer::FORM_C) ?: $text;
        }
        return $multiline ? $text : trim($text);
    }

    // ─── Zones ─────────────────────────────────────────────────

    private function textZone(array $zone, string $path, array $fontIds): array
    {
        $style = is_array($zone['style'] ?? null) ? $zone['style'] : [];
        $controls = is_array($zone['controls'] ?? null) ? $zone['controls'] : [];
        $maxText = (int) config('banners.text.max_length', 200);

        $textCtl = $this->controlBlock($controls, 'text');
        $multiline = $this->bool($textCtl['multiline'] ?? false);
        $maxLength = (int) $this->number($textCtl['maxLength'] ?? 40, "{$path}.controls.text.maxLength", 1, $maxText, 0);

        $default = self::cleanText((string) ($style['text'] ?? ''), $multiline);
        if (mb_strlen($default) > $maxLength) {
            $this->fail("{$path}.style.text", "Default text is longer than the {$maxLength} character limit");
        }

        $fontId = (int) ($style['fontId'] ?? 0);
        if (!in_array($fontId, $fontIds, true)) {
            $this->fail("{$path}.style.fontId", 'Pick a font');
        }

        $size = $this->number($style['size'] ?? 4, "{$path}.style.size", 0.2, 30);
        $minSize = $this->number($style['minSize'] ?? $size / 2, "{$path}.style.minSize", 0.2, 30);
        if ($minSize > $size) {
            $this->fail("{$path}.style.minSize", 'Minimum size must not exceed the base size');
        }

        $sizeCtl = $this->controlBlock($controls, 'size');
        $sizeMin = $this->number($sizeCtl['min'] ?? $minSize, "{$path}.controls.size.min", 0.2, 30);
        $sizeMax = $this->number($sizeCtl['max'] ?? $size, "{$path}.controls.size.max", 0.2, 30);
        if ($sizeMin < $minSize || $sizeMin > $size || $sizeMax < $size) {
            $this->fail("{$path}.controls.size", 'Size limits must satisfy: min size ≤ slider min ≤ base size ≤ slider max');
        }

        $colorCtl = $this->controlBlock($controls, 'color');
        $palette = [];
        foreach (array_slice((array) ($colorCtl['palette'] ?? []), 0, 12) as $j => $hex) {
            $palette[] = $this->hex($hex, "{$path}.controls.color.palette.{$j}");
        }
        $palette = array_values(array_unique($palette));

        $alignCtl = $this->controlBlock($controls, 'align');
        $options = array_values(array_intersect(self::ALIGN, (array) ($alignCtl['options'] ?? self::ALIGN)));
        $align = $this->choice($style['align'] ?? 'center', self::ALIGN, "{$path}.style.align");
        if ($options === []) {
            $options = [$align];
        }
        if ($this->bool($alignCtl['enabled'] ?? false) && !in_array($align, $options, true)) {
            $this->fail("{$path}.style.align", 'Default alignment must be one of the allowed options');
        }

        $fontCtl = $this->controlBlock($controls, 'font');
        $fontEnabled = $this->bool($fontCtl['enabled'] ?? false);
        $fontOptions = [];
        foreach (array_slice((array) ($fontCtl['options'] ?? []), 0, self::MAX_FONT_OPTIONS) as $j => $id) {
            if (!is_numeric($id) || !in_array((int) $id, $fontIds, true)) {
                // A font deleted while the choice was switched off is just dropped
                if ($fontEnabled) {
                    $this->fail("{$path}.controls.font.options.{$j}", 'Unknown font');
                }
                continue;
            }
            $fontOptions[] = (int) $id;
        }
        // The default font is always one of the choices
        $fontOptions = array_values(array_unique([$fontId, ...$fontOptions]));

        $case = $this->choice($style['case'] ?? 'none', self::CASES, "{$path}.style.case");
        $caseCtl = $this->controlBlock($controls, 'case');
        $caseOptions = array_values(array_intersect(self::CASES, [$case, ...(array) ($caseCtl['options'] ?? self::CASES)]));

        $lineHeight = $this->number($style['lineHeight'] ?? 1.14, "{$path}.style.lineHeight", 0.6, 3);
        $letterSpacing = $this->number($style['letterSpacing'] ?? 0, "{$path}.style.letterSpacing", -0.5, 1, 3);
        $opacity = (int) $this->number($style['opacity'] ?? 100, "{$path}.style.opacity", 10, 100, 0);

        $base = $this->zoneBase($zone, $path);

        return $base + [
            'style' => [
                'text' => $default,
                'fontId' => $fontId,
                'size' => $size,
                'minSize' => $minSize,
                'case' => $case,
                'align' => $align,
                'color' => $this->hex($style['color'] ?? '#ffffff', "{$path}.style.color"),
                'glow' => $this->bool($style['glow'] ?? true),
                'lineHeight' => $lineHeight,
                'letterSpacing' => $letterSpacing,
                'opacity' => $opacity,
            ],
            'controls' => [
                'text' => ['enabled' => $this->bool($textCtl['enabled'] ?? false), 'maxLength' => $maxLength, 'multiline' => $multiline],
                'size' => ['enabled' => $this->bool($sizeCtl['enabled'] ?? false), 'min' => $sizeMin, 'max' => $sizeMax],
                'color' => [
                    'enabled' => $this->bool($colorCtl['enabled'] ?? false),
                    'palette' => $palette,
                    'custom' => $this->bool($colorCtl['custom'] ?? false),
                ],
                'align' => ['enabled' => $this->bool($alignCtl['enabled'] ?? false), 'options' => $options],
                'visible' => ['enabled' => $this->bool($this->controlBlock($controls, 'visible')['enabled'] ?? false)],
                'font' => ['enabled' => $fontEnabled, 'options' => $fontOptions],
                'case' => ['enabled' => $this->bool($caseCtl['enabled'] ?? false), 'options' => $caseOptions],
                'letterSpacing' => $this->range($controls, 'letterSpacing', $letterSpacing, $path, -0.5, 1, 3),
                'lineHeight' => $this->range($controls, 'lineHeight', $lineHeight, $path, 0.6, 3, 2),
                'glow' => ['enabled' => $this->bool($this->controlBlock($controls, 'glow')['enabled'] ?? false)],
                'opacity' => $this->range($controls, 'opacity', $opacity, $path, 10, 100, 0),
                'position' => $this->position($controls, $base, $path),
            ],
        ];
    }

    /**
     * A slider limit block. Missing limits default to the zone's own value. A switched-off block
     * is widened to include the default instead of failing, so editing the default look never
     * trips over a control nobody uses.
     */
    private function range(array $controls, string $name, float $default, string $path, float $lo, float $hi, int $decimals): array
    {
        $ctl = $this->controlBlock($controls, $name);
        $enabled = $this->bool($ctl['enabled'] ?? false);
        $min = $this->number($ctl['min'] ?? $default, "{$path}.controls.{$name}.min", $lo, $hi, $decimals);
        $max = $this->number($ctl['max'] ?? $default, "{$path}.controls.{$name}.max", $lo, $hi, $decimals);
        if ($enabled && ($min > $default || $default > $max)) {
            $this->fail("{$path}.controls.{$name}", 'Limits must satisfy: min ≤ default ≤ max');
        }
        if (!$enabled) {
            [$min, $max] = [min($min, $default), max($max, $default)];
        }
        $cast = fn (float $n) => $decimals === 0 ? (int) $n : $n;

        return ['enabled' => $enabled, 'min' => $cast($min), 'max' => $cast($max)];
    }

    private function imageZone(array $zone, string $path): array
    {
        $style = is_array($zone['style'] ?? null) ? $zone['style'] : [];
        $controls = is_array($zone['controls'] ?? null) ? $zone['controls'] : [];
        $maxBytes = (int) config('banners.logo.max_kb', 2048) * 1024;

        $upload = $this->controlBlock($controls, 'upload');
        $scaleCtl = $this->controlBlock($controls, 'scale');
        $alignCtl = $this->controlBlock($controls, 'align');

        $scale = $this->number($style['scale'] ?? 100, "{$path}.style.scale", 10, 100, 0);
        $min = $this->number($scaleCtl['min'] ?? 30, "{$path}.controls.scale.min", 10, 100, 0);
        $max = $this->number($scaleCtl['max'] ?? 100, "{$path}.controls.scale.max", 10, 100, 0);
        if ($min > $scale || $scale > $max) {
            $this->fail("{$path}.controls.scale", 'Scale limits must satisfy: min ≤ default ≤ max');
        }

        $xs = array_values(array_intersect(self::ALIGN, (array) ($alignCtl['x'] ?? self::ALIGN)));
        $ys = array_values(array_intersect(self::ALIGN_Y, (array) ($alignCtl['y'] ?? self::ALIGN_Y)));
        $alignX = $this->choice($style['alignX'] ?? 'center', self::ALIGN, "{$path}.style.alignX");
        $alignY = $this->choice($style['alignY'] ?? 'center', self::ALIGN_Y, "{$path}.style.alignY");

        $base = $this->zoneBase($zone, $path);

        return $base + [
            'style' => ['scale' => (int) $scale, 'alignX' => $alignX, 'alignY' => $alignY],
            'controls' => [
                'upload' => [
                    'enabled' => $this->bool($upload['enabled'] ?? true),
                    'maxBytes' => (int) $this->number($upload['maxBytes'] ?? $maxBytes, "{$path}.controls.upload.maxBytes", 10 * 1024, $maxBytes, 0),
                ],
                'scale' => ['enabled' => $this->bool($scaleCtl['enabled'] ?? false), 'min' => (int) $min, 'max' => (int) $max],
                'align' => [
                    'enabled' => $this->bool($alignCtl['enabled'] ?? false),
                    'x' => $xs ?: [$alignX],
                    'y' => $ys ?: [$alignY],
                ],
                'position' => $this->position($controls, $base, $path),
            ],
        ];
    }

    /**
     * Where the buyer may drag the zone (and resize it, if allowed). The area must contain the
     * zone itself; while the control is off it is widened to do so instead of failing.
     */
    private function position(array $controls, array $rect, string $path): array
    {
        $ctl = $this->controlBlock($controls, 'position');
        $enabled = $this->bool($ctl['enabled'] ?? false);
        $b = is_array($ctl['bounds'] ?? null) ? $ctl['bounds'] : [];
        $p = "{$path}.controls.position.bounds";
        $x = $this->number($b['x'] ?? 0, "{$p}.x", 0, 100, 3);
        $y = $this->number($b['y'] ?? 0, "{$p}.y", 0, 100, 3);
        $w = $this->number($b['w'] ?? 100 - $x, "{$p}.w", 0.5, 100, 3);
        $h = $this->number($b['h'] ?? 100 - $y, "{$p}.h", 0.5, 100, 3);
        if ($x + $w > 100.001 || $y + $h > 100.001) {
            $this->fail($p, 'The area must stay inside the video');
        }

        $e = 0.001;
        $inside = $rect['x'] >= $x - $e && $rect['y'] >= $y - $e
            && $rect['x'] + $rect['w'] <= $x + $w + $e && $rect['y'] + $rect['h'] <= $y + $h + $e;
        if (!$inside && $enabled) {
            $this->fail($p, 'The area must contain the zone');
        } elseif (!$inside) {
            $x1 = max($x + $w, $rect['x'] + $rect['w']);
            $y1 = max($y + $h, $rect['y'] + $rect['h']);
            $x = min($x, $rect['x']);
            $y = min($y, $rect['y']);
            [$w, $h] = [round($x1 - $x, 3), round($y1 - $y, 3)];
        }

        return [
            'enabled' => $enabled,
            'resize' => $this->bool($ctl['resize'] ?? false),
            'bounds' => ['x' => $x, 'y' => $y, 'w' => $w, 'h' => $h],
        ];
    }

    private function zoneBase(array $zone, string $path): array
    {
        $label = self::cleanText((string) ($zone['label'] ?? ''), false);
        if ($label === '' || mb_strlen($label) > 60) {
            $this->fail("{$path}.label", 'Label: 1 to 60 characters');
        }
        $x = $this->number($zone['x'] ?? null, "{$path}.x", 0, 100, 3);
        $y = $this->number($zone['y'] ?? null, "{$path}.y", 0, 100, 3);
        $w = $this->number($zone['w'] ?? null, "{$path}.w", 0.5, 100, 3);
        $h = $this->number($zone['h'] ?? null, "{$path}.h", 0.5, 100, 3);
        if ($x + $w > 100.001 || $y + $h > 100.001) {
            $this->fail("{$path}.w", 'The zone must stay inside the video');
        }

        return [
            'key' => (string) ($zone['key'] ?? ''),
            'type' => $zone['type'],
            'label' => $label,
            'x' => $x, 'y' => $y, 'w' => $w, 'h' => $h,
        ];
    }

    private function hue(mixed $hue, string $path): array
    {
        $hue = is_array($hue) ? $hue : [];
        $presets = [];
        foreach (array_slice((array) ($hue['presets'] ?? [0, 35, 95, 150, 195, 250, 300]), 0, 12) as $j => $deg) {
            $presets[] = (int) $this->number($deg, "{$path}.presets.{$j}", 0, 359, 0);
        }

        return [
            'enabled' => $this->bool($hue['enabled'] ?? true),
            'default' => (int) $this->number($hue['default'] ?? 0, "{$path}.default", 0, 359, 0),
            'presets' => array_values(array_unique($presets)),
        ];
    }

    // ─── Helpers ───────────────────────────────────────────────

    /** Font ids that zones may use (as default or as a buyer choice): existing, not deleted. */
    private function availableFontIds(array $zones): array
    {
        $wanted = [];
        foreach ($zones as $zone) {
            if (!is_array($zone)) {
                continue;
            }
            if (isset($zone['style']['fontId']) && is_numeric($zone['style']['fontId'])) {
                $wanted[] = (int) $zone['style']['fontId'];
            }
            foreach ((array) ($zone['controls']['font']['options'] ?? []) as $id) {
                if (is_numeric($id)) {
                    $wanted[] = (int) $id;
                }
            }
        }
        if (!$wanted) {
            return [];
        }
        return BannerFont::whereIn('id', array_unique($wanted))->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    private function controlBlock(array $controls, string $name): array
    {
        return is_array($controls[$name] ?? null) ? $controls[$name] : [];
    }

    private function number(mixed $value, string $path, float $min, float $max, int $decimals = 2): float
    {
        if (!is_numeric($value) || !is_finite((float) $value)) {
            $this->fail($path, 'Must be a number');
            return $min;
        }
        $n = round((float) $value, $decimals);
        if ($n < $min || $n > $max) {
            $this->fail($path, "Must be between {$min} and {$max}");
        }
        return max($min, min($max, $n));
    }

    private function hex(mixed $value, string $path): string
    {
        $hex = strtolower(trim((string) $value));
        if (!preg_match(self::HEX_PATTERN, $hex)) {
            $this->fail($path, 'Color must look like #rrggbb');
            return '#ffffff';
        }
        return $hex;
    }

    private function choice(mixed $value, array $allowed, string $path): string
    {
        if (!in_array($value, $allowed, true)) {
            $this->fail($path, 'Must be one of: ' . implode(', ', $allowed));
            return $allowed[0];
        }
        return $value;
    }

    private function bool(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    private function fail(string $path, string $message): ?array
    {
        $this->errors[$path][] = $message;
        return null;
    }

    private function throwIfFailed(): void
    {
        if ($this->errors) {
            throw ValidationException::withMessages($this->errors);
        }
    }
}
