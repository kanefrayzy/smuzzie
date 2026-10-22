<?php

namespace App\Services\Banners;

/**
 * Layers the buyer adds on top of a template (config.custom). Each layer is validated and
 * rendered as a synthetic zone with every control switched on, so the zone rules apply to it.
 * Mirror of frontend/src/lib/banner-overlay/custom.ts: keep the limits below in sync.
 */
class BannerCustomLayers
{
    public const ID_PATTERN = '/^layer_[0-9]{1,3}$/';

    public const TEXT_MAX_LENGTH = 100;
    public const SIZE = [0.2, 20, 4];           // min, max, default (percent of the width)
    public const MIN_SIZE = 0.2;
    public const LETTER_SPACING = [-0.1, 0.5];
    public const LINE_HEIGHT = [0.7, 2.5, 1.15];
    public const OPACITY = [10, 100];
    public const IMAGE_SCALE = [10, 100];
    public const LOGO_MAX_BYTES = 2 * 1024 * 1024;

    /** The custom block when the template allows adding layers, else null. */
    public static function config(array $config): ?array
    {
        $c = $config['custom'] ?? null;
        if (!is_array($c) || !($c['enabled'] ?? false) || (($c['maxText'] ?? 0) <= 0 && ($c['maxImage'] ?? 0) <= 0)) {
            return null;
        }
        return $c;
    }

    /** Starting rectangle of a new layer, also the synthetic zone's own place. */
    public static function startRect(array $custom, string $type): array
    {
        $b = $custom['bounds'];
        $w = min($b['w'], $type === 'text' ? 60 : 30);
        $h = min($b['h'], $type === 'text' ? 10 : 12);
        return [
            'x' => round($b['x'] + ($b['w'] - $w) / 2, 3),
            'y' => round($b['y'] + ($b['h'] - $h) / 2, 3),
            'w' => round($w, 3),
            'h' => round($h, 3),
        ];
    }

    public static function textZone(array $config, string $id): array
    {
        $custom = $config['custom'];
        return ['key' => $id, 'type' => 'text', 'label' => 'Text'] + self::startRect($custom, 'text') + [
            'style' => [
                'text' => 'Your text', 'fontId' => (int) ($custom['fonts'][0] ?? 0), 'size' => self::SIZE[2], 'minSize' => self::MIN_SIZE,
                'case' => 'none', 'align' => 'center', 'color' => '#ffffff', 'glow' => false,
                'lineHeight' => self::LINE_HEIGHT[2], 'letterSpacing' => 0, 'opacity' => 100,
                'gradient' => ['enabled' => false, 'from' => '#ffffff', 'to' => '#ff2d8a', 'angle' => 90],
            ],
            'controls' => [
                'text' => ['enabled' => true, 'maxLength' => self::TEXT_MAX_LENGTH, 'multiline' => true],
                'size' => ['enabled' => true, 'min' => self::SIZE[0], 'max' => self::SIZE[1]],
                'color' => ['enabled' => true, 'palette' => [], 'custom' => true],
                'align' => ['enabled' => true, 'options' => BannerConfigValidator::ALIGN],
                'visible' => ['enabled' => false],
                'font' => ['enabled' => true, 'options' => array_map('intval', $custom['fonts'])],
                'case' => ['enabled' => true, 'options' => BannerConfigValidator::CASES],
                'letterSpacing' => ['enabled' => true, 'min' => self::LETTER_SPACING[0], 'max' => self::LETTER_SPACING[1]],
                'lineHeight' => ['enabled' => true, 'min' => self::LINE_HEIGHT[0], 'max' => self::LINE_HEIGHT[1]],
                'glow' => ['enabled' => true],
                'opacity' => ['enabled' => true, 'min' => self::OPACITY[0], 'max' => self::OPACITY[1]],
                'position' => ['enabled' => true, 'resize' => true, 'bounds' => $custom['bounds']],
                'gradient' => ['enabled' => true],
            ],
        ];
    }

    public static function imageZone(array $config, string $id): array
    {
        $custom = $config['custom'];
        return ['key' => $id, 'type' => 'image', 'label' => 'Image'] + self::startRect($custom, 'image') + [
            'style' => ['scale' => 100, 'alignX' => 'center', 'alignY' => 'center'],
            'controls' => [
                'upload' => ['enabled' => true, 'maxBytes' => self::LOGO_MAX_BYTES],
                'scale' => ['enabled' => true, 'min' => self::IMAGE_SCALE[0], 'max' => self::IMAGE_SCALE[1]],
                'align' => ['enabled' => true, 'x' => BannerConfigValidator::ALIGN, 'y' => BannerConfigValidator::ALIGN_Y],
                'position' => ['enabled' => true, 'resize' => true, 'bounds' => $custom['bounds']],
            ],
        ];
    }

    /**
     * Synthetic zone of each stored (already validated) layer, keyed by layer id.
     *
     * @return array<string, array>
     */
    public static function zones(array $config, array $params): array
    {
        if (!self::config($config)) {
            return [];
        }
        $zones = [];
        foreach ($params['layers'] ?? [] as $layer) {
            $zones[$layer['id']] = $layer['type'] === 'text'
                ? self::textZone($config, $layer['id'])
                : self::imageZone($config, $layer['id']);
        }
        return $zones;
    }
}
