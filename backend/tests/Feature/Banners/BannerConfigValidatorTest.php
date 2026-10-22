<?php

namespace Tests\Feature\Banners;

use App\Models\BannerFont;
use App\Services\Banners\BannerConfigValidator;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class BannerConfigValidatorTest extends TestCase
{
    use RefreshDatabase;

    private BannerConfigValidator $validator;
    private BannerFont $font;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = new BannerConfigValidator();
        $this->font = BannerFont::factory()->create();
    }

    private function config(): array
    {
        return BannerTemplateFactory::sampleConfig($this->font->id);
    }

    /** @return array<string, string[]> */
    private function errorsFor(array $config): array
    {
        try {
            $this->validator->validate($config);
        } catch (ValidationException $e) {
            return $e->errors();
        }
        $this->fail('Expected a validation error');
    }

    public function test_sample_config_passes_and_is_canonical(): void
    {
        $out = $this->validator->validate($this->config());

        $this->assertSame(1, $out['schemaVersion']);
        $this->assertCount(3, $out['zones']);
        $title = $out['zones'][1];
        $this->assertSame(
            ['text', 'size', 'color', 'align', 'visible', 'font', 'case', 'letterSpacing', 'lineHeight', 'glow', 'opacity', 'position'],
            array_keys($title['controls'])
        );
        $this->assertSame(32, $title['controls']['text']['maxLength']);
        $this->assertSame($this->font->id, $title['style']['fontId']);
        $this->assertSame(['upload', 'scale', 'align', 'position'], array_keys($out['zones'][0]['controls']));
    }

    public function test_missing_blocks_are_filled_and_unknown_keys_dropped(): void
    {
        $out = $this->validator->validate([
            'accent' => '#ABCDEF',
            'evil' => '<script>',
            'zones' => [[
                'key' => 'title', 'type' => 'text', 'label' => 'Title', 'x' => 10, 'y' => 10, 'w' => 50, 'h' => 10,
                'style' => ['fontId' => $this->font->id, 'size' => 4, 'onload' => 'x'],
                'extra' => true,
            ]],
        ]);

        $this->assertSame('#abcdef', $out['accent']);
        $this->assertArrayNotHasKey('evil', $out);
        $zone = $out['zones'][0];
        $this->assertArrayNotHasKey('extra', $zone);
        $this->assertArrayNotHasKey('onload', $zone['style']);
        $this->assertFalse($zone['controls']['text']['enabled']);
        $this->assertFalse($zone['controls']['visible']['enabled']);
        $this->assertSame(2.0, $zone['style']['minSize']); // half of size by default
    }

    public function test_rejects_bad_and_duplicate_keys(): void
    {
        $config = $this->config();
        $config['zones'][1]['key'] = 'Bad Key';
        $config['zones'][2]['key'] = 'logo';

        $errors = $this->errorsFor($config);
        $this->assertArrayHasKey('config.zones.1.key', $errors);
        $this->assertArrayHasKey('config.zones.2.key', $errors);
    }

    public function test_rejects_unknown_or_deleted_font(): void
    {
        $config = $this->config();
        $config['zones'][1]['style']['fontId'] = 99999;
        $this->assertArrayHasKey('config.zones.1.style.fontId', $this->errorsFor($config));

        $this->font->delete();
        $this->assertArrayHasKey('config.zones.1.style.fontId', $this->errorsFor($this->config()));
    }

    public function test_size_limits_must_be_ordered(): void
    {
        $config = $this->config();
        $config['zones'][1]['controls']['size'] = ['enabled' => true, 'min' => 5, 'max' => 6]; // min > base 4.4

        $this->assertArrayHasKey('config.zones.1.controls.size', $this->errorsFor($config));
    }

    public function test_zone_must_stay_inside_the_video(): void
    {
        $config = $this->config();
        $config['zones'][1]['x'] = 80; // + w 47 > 100

        $this->assertArrayHasKey('config.zones.1.w', $this->errorsFor($config));
    }

    public function test_default_text_must_fit_the_limit(): void
    {
        $config = $this->config();
        $config['zones'][1]['style']['text'] = str_repeat('Я', 33); // maxLength 32, counted in characters

        $this->assertArrayHasKey('config.zones.1.style.text', $this->errorsFor($config));
    }

    public function test_bad_colors_and_choices(): void
    {
        $config = $this->config();
        $config['accent'] = 'red';
        $config['zones'][1]['style']['case'] = 'title';
        $config['zones'][1]['controls']['color']['palette'][] = '#12345';

        $errors = $this->errorsFor($config);
        $this->assertArrayHasKey('config.accent', $errors);
        $this->assertArrayHasKey('config.zones.1.style.case', $errors);
        $this->assertArrayHasKey('config.zones.1.controls.color.palette.3', $errors);
    }

    public function test_image_zone_limit(): void
    {
        $config = $this->config();
        $logo = $config['zones'][0];
        foreach (range(2, 13) as $n) { // 13 image zones, the limit is 12
            $config['zones'][] = ['key' => "logo{$n}"] + $logo;
        }

        $this->assertArrayHasKey('config.zones', $this->errorsFor($config));
    }

    public function test_watermark_and_outputs(): void
    {
        $this->assertSame(
            ['text' => 'MY PREVIEW', 'opacity' => 20],
            $this->validator->validateWatermark(['text' => "  MY PREVIEW\u{0007}", 'opacity' => 20])
        );
        $outputs = $this->validator->validateOutputs(['mp4' => false, 'gif' => ['enabled' => true, 'width' => 480, 'fps' => 12]], 1450);
        $this->assertTrue($outputs['mp4']); // mp4 is always produced
        $this->assertSame(['enabled' => true, 'width' => 480, 'fps' => 12], $outputs['gif']);

        $this->expectException(ValidationException::class);
        $this->validator->validateOutputs(['gif' => ['enabled' => true, 'width' => 900, 'fps' => 15]], 640);
    }

    public function test_clean_text_strips_control_chars_and_normalizes(): void
    {
        $this->assertSame('Café', BannerConfigValidator::cleanText("Cafe\u{0301}\u{200B}", false));
        $this->assertSame("a\nb", BannerConfigValidator::cleanText("a\r\nb", true));
        $this->assertSame('ab', BannerConfigValidator::cleanText("a\nb", false));
    }
}
