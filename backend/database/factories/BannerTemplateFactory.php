<?php

namespace Database\Factories;

use App\Enums\BannerTemplateStatus;
use App\Models\BannerFont;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\BannerTemplate>
 */
class BannerTemplateFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'slug' => Str::slug($name) . '-' . Str::lower(Str::random(4)),
            'name' => Str::title($name),
            'description' => null,
            'price' => 15,
            'currency' => 'USD',
            'is_active' => false,
            'sort_order' => 0,
            'config' => fn () => self::sampleConfig(BannerFont::factory()->create()->id),
            'outputs' => config('banners.template.default_outputs'),
            'watermark' => config('banners.template.default_watermark'),
            'processing_status' => BannerTemplateStatus::None,
        ];
    }

    /** Video processed and template switched on: visible in the public catalog. */
    public function published(): static
    {
        return $this->state(function () {
            $uuid = (string) Str::uuid();
            return [
                'is_active' => true,
                'processing_status' => BannerTemplateStatus::Ready,
                'processed_at' => now(),
                'source_rev' => 1,
                'source_path' => "templates/{$uuid}/source-1.mp4",
                'preview_path' => "banners/templates/{$uuid}/preview-1.mp4",
                'poster_path' => "banners/templates/{$uuid}/poster-1.webp",
                'width' => 1450,
                'height' => 1694,
                'frame_count' => 120,
                'duration' => 4,
                'fps' => 30,
            ];
        });
    }

    /**
     * Schema v1 config modelled on the prototype (docs/banners/prototype/public/template/template.json):
     * a logo zone, a heading with every control on, and a fixed button label with controls off.
     */
    public static function sampleConfig(int $fontId): array
    {
        return [
            'schemaVersion' => 1,
            'accent' => '#1e9bff',
            'hue' => ['enabled' => true, 'default' => 0, 'presets' => [0, 35, 95, 150, 195, 250, 300]],
            'zones' => [
                [
                    'key' => 'logo', 'type' => 'image', 'label' => 'Логотип',
                    'x' => 30, 'y' => 3.3, 'w' => 40, 'h' => 5.6,
                    'style' => ['scale' => 100, 'alignX' => 'center', 'alignY' => 'center'],
                    'controls' => [
                        'upload' => ['enabled' => true, 'maxBytes' => 2 * 1024 * 1024],
                        'scale' => ['enabled' => true, 'min' => 30, 'max' => 100],
                        'align' => ['enabled' => true, 'x' => ['left', 'center', 'right'], 'y' => ['top', 'center', 'bottom']],
                    ],
                ],
                [
                    'key' => 'title', 'type' => 'text', 'label' => 'Заголовок',
                    'x' => 26.5, 'y' => 14.6, 'w' => 47, 'h' => 9.2,
                    'style' => [
                        'text' => 'SMUZZIE STUDIO', 'fontId' => $fontId,
                        'size' => 4.4, 'minSize' => 2.2, 'case' => 'upper', 'align' => 'center',
                        'color' => '#ffffff', 'glow' => true, 'lineHeight' => 1.14, 'letterSpacing' => -0.01,
                    ],
                    'controls' => [
                        'text' => ['enabled' => true, 'maxLength' => 32, 'multiline' => false],
                        'size' => ['enabled' => true, 'min' => 2.2, 'max' => 6.0],
                        'color' => ['enabled' => true, 'palette' => ['#ffffff', '#1e9bff', '#ffd400'], 'custom' => true],
                        'align' => ['enabled' => true, 'options' => ['left', 'center', 'right']],
                        'visible' => ['enabled' => true],
                    ],
                ],
                [
                    'key' => 'button', 'type' => 'text', 'label' => 'Кнопка',
                    'x' => 34.5, 'y' => 87.9, 'w' => 31, 'h' => 4.6,
                    'style' => [
                        'text' => 'Начать', 'fontId' => $fontId,
                        'size' => 2.5, 'minSize' => 1.4, 'case' => 'upper', 'align' => 'center',
                        'color' => '#ffffff', 'glow' => false, 'lineHeight' => 1.14, 'letterSpacing' => -0.01,
                    ],
                    'controls' => [
                        'text' => ['enabled' => true, 'maxLength' => 20, 'multiline' => false],
                        'size' => ['enabled' => false, 'min' => 1.4, 'max' => 2.5],
                        'color' => ['enabled' => false, 'palette' => [], 'custom' => false],
                        'align' => ['enabled' => false, 'options' => ['center']],
                        'visible' => ['enabled' => false],
                    ],
                ],
            ],
        ];
    }
}
