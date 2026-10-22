<?php

namespace Tests\Feature\Banners;

use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use App\Services\Banners\BannerConfigValidator;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/** Buyer style controls: font choice, letter case, spacing, line height, glow, opacity. */
class BannerStyleControlsTest extends TestCase
{
    use RefreshDatabase;

    private BannerFont $font;
    private BannerFont $alt;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Queue::fake();
        $this->font = BannerFont::factory()->create();
        $this->alt = BannerFont::factory()->create();
    }

    /** Sample config with every style control of the title switched on. */
    private function config(array $titleControls = []): array
    {
        $config = BannerTemplateFactory::sampleConfig($this->font->id);
        $config['zones'][1]['style']['opacity'] = 90;
        $config['zones'][1]['controls'] += array_replace([
            'font' => ['enabled' => true, 'options' => [$this->alt->id]],
            'case' => ['enabled' => true, 'options' => ['none', 'lower']],
            'letterSpacing' => ['enabled' => true, 'min' => -0.05, 'max' => 0.2],
            'lineHeight' => ['enabled' => true, 'min' => 0.9, 'max' => 1.6],
            'glow' => ['enabled' => true],
            'opacity' => ['enabled' => true, 'min' => 40, 'max' => 100],
        ], $titleControls);
        return $config;
    }

    private function errorsFor(array $config): array
    {
        try {
            (new BannerConfigValidator())->validate($config);
        } catch (ValidationException $e) {
            return $e->errors();
        }
        $this->fail('Expected a validation error');
    }

    public function test_config_without_the_new_blocks_gets_them_switched_off(): void
    {
        $out = (new BannerConfigValidator())->validate(BannerTemplateFactory::sampleConfig($this->font->id));
        $title = $out['zones'][1];

        $this->assertSame(100, $title['style']['opacity']);
        $this->assertSame(['enabled' => false, 'options' => [$this->font->id]], $title['controls']['font']);
        $this->assertSame(['enabled' => false, 'options' => ['none', 'upper', 'lower']], $title['controls']['case']);
        $this->assertSame(['enabled' => false, 'min' => 1.14, 'max' => 1.14], $title['controls']['lineHeight']);
        $this->assertSame(['enabled' => false, 'min' => -0.01, 'max' => -0.01], $title['controls']['letterSpacing']);
        $this->assertSame(['enabled' => false], $title['controls']['glow']);
        $this->assertSame(['enabled' => false, 'min' => 100, 'max' => 100], $title['controls']['opacity']);
    }

    public function test_enabled_blocks_are_normalized(): void
    {
        $title = (new BannerConfigValidator())->validate($this->config())['zones'][1];

        // The default font and case are always among the choices
        $this->assertSame([$this->font->id, $this->alt->id], $title['controls']['font']['options']);
        $this->assertSame(['none', 'upper', 'lower'], $title['controls']['case']['options']);
        $this->assertSame(['enabled' => true, 'min' => 40, 'max' => 100], $title['controls']['opacity']);
        $this->assertSame(90, $title['style']['opacity']);
    }

    public function test_font_choices_must_exist_while_the_choice_is_on(): void
    {
        $errors = $this->errorsFor($this->config(['font' => ['enabled' => true, 'options' => [999]]]));
        $this->assertArrayHasKey('config.zones.1.controls.font.options.0', $errors);

        // Switched off: a stale id is dropped instead of blocking the save
        $out = (new BannerConfigValidator())->validate($this->config(['font' => ['enabled' => false, 'options' => [999]]]));
        $this->assertSame([$this->font->id], $out['zones'][1]['controls']['font']['options']);
    }

    public function test_enabled_ranges_must_include_the_default(): void
    {
        $errors = $this->errorsFor($this->config(['lineHeight' => ['enabled' => true, 'min' => 1.2, 'max' => 1.6]]));
        $this->assertArrayHasKey('config.zones.1.controls.lineHeight', $errors);

        // Off: widened to include the default
        $out = (new BannerConfigValidator())->validate($this->config(['lineHeight' => ['enabled' => false, 'min' => 1.2, 'max' => 1.6]]));
        $this->assertSame(['enabled' => false, 'min' => 1.14, 'max' => 1.6], $out['zones'][1]['controls']['lineHeight']);
    }

    public function test_template_fonts_include_the_buyer_choices(): void
    {
        $template = BannerTemplate::factory()->published()->create([
            'slug' => 'neon',
            'config' => (new BannerConfigValidator())->validate($this->config()),
        ]);

        $this->assertSame([$this->font->id, $this->alt->id], $template->fontIds());
        $this->getJson('/api/v1/banners/templates/neon')->assertOk()->assertJsonCount(2, 'fonts');

        // A font a buyer can pick can't be deleted from under the template
        $this->assertSame([$this->font->id], BannerTemplate::factory()->make([
            'config' => (new BannerConfigValidator())->validate($this->config(['font' => ['enabled' => false, 'options' => [$this->alt->id]]])),
        ])->fontIds());
    }

    private function order(array $title)
    {
        BannerTemplate::factory()->published()->create([
            'slug' => 'neon',
            'config' => (new BannerConfigValidator())->validate($this->config()),
        ]);

        return $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'buyer@example.com',
            'params' => json_encode(['schemaVersion' => 1, 'hue' => 0, 'zones' => ['title' => $title]]),
        ], ['Accept' => 'application/json']);
    }

    public function test_buyer_style_choices_are_stored_and_fonts_go_into_the_snapshot(): void
    {
        $this->order([
            'fontId' => $this->alt->id, 'case' => 'lower', 'letterSpacing' => 0.1234,
            'lineHeight' => 1.333, 'glow' => false, 'opacity' => 55,
        ])->assertCreated();

        $order = BannerOrder::firstOrFail();
        $this->assertEquals([
            'fontId' => $this->alt->id, 'case' => 'lower', 'letterSpacing' => 0.123,
            'lineHeight' => 1.33, 'glow' => false, 'opacity' => 55,
        ], $order->params['zones']['title']);
        $this->assertEqualsCanonicalizing([$this->font->id, $this->alt->id], array_column($order->snapshot['fonts'], 'id'));
    }

    /** @dataProvider invalidStyles */
    public function test_invalid_style_choices_are_rejected(array $title, string $field): void
    {
        $this->order($title)->assertStatus(422)->assertJsonValidationErrors("params.zones.title.{$field}");
    }

    public static function invalidStyles(): array
    {
        return [
            'font not offered' => [['fontId' => 999], 'fontId'],
            'font as string' => [['fontId' => '1'], 'fontId'],
            'case not offered' => [['case' => 'title'], 'case'],
            'spacing too wide' => [['letterSpacing' => 0.5], 'letterSpacing'],
            'line height too small' => [['lineHeight' => 0.5], 'lineHeight'],
            'opacity too low' => [['opacity' => 10], 'opacity'],
            'opacity not a number' => [['opacity' => 'half'], 'opacity'],
            'glow not a bool' => [['glow' => 'yes'], 'glow'],
        ];
    }

    public function test_style_choices_are_dropped_where_the_template_does_not_allow_them(): void
    {
        // The button zone has none of the new blocks (like orders made before they existed)
        BannerTemplate::factory()->published()->create(['slug' => 'neon', 'config' => BannerTemplateFactory::sampleConfig($this->font->id)]);

        $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'buyer@example.com',
            'params' => json_encode(['zones' => ['button' => ['text' => 'Go', 'fontId' => $this->alt->id, 'opacity' => 10, 'glow' => true]]]),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame(['text' => 'Go'], BannerOrder::firstOrFail()->params['zones']['button']);
    }
}
