<?php

namespace Tests\Feature\Banners;

use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use App\Services\Banners\BannerConfigValidator;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/** Texts and images the buyer adds on top of a template (config.custom, params.layers). */
class BannerCustomLayersTest extends TestCase
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

    private function config(array $custom = []): array
    {
        $config = BannerTemplateFactory::sampleConfig($this->font->id);
        $config['custom'] = array_replace([
            'enabled' => true, 'maxText' => 2, 'maxImage' => 1,
            'fonts' => [$this->alt->id, $this->font->id],
            'bounds' => ['x' => 0, 'y' => 0, 'w' => 100, 'h' => 80],
        ], $custom);
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

    public function test_custom_block_defaults_to_off(): void
    {
        $out = (new BannerConfigValidator())->validate(BannerTemplateFactory::sampleConfig($this->font->id));

        $this->assertSame([
            'enabled' => false, 'maxText' => 3, 'maxImage' => 1, 'fonts' => [],
            'bounds' => ['x' => 0.0, 'y' => 0.0, 'w' => 100.0, 'h' => 100.0],
        ], $out['custom']);
    }

    public function test_custom_block_validation(): void
    {
        $this->assertArrayHasKey('config.custom.fonts', $this->errorsFor($this->config(['fonts' => []])));
        $this->assertArrayHasKey('config.custom.fonts.0', $this->errorsFor($this->config(['fonts' => [999]])));
        $this->assertArrayHasKey('config.custom.maxText', $this->errorsFor($this->config(['maxText' => 50])));
        $this->assertArrayHasKey('config.custom.bounds', $this->errorsFor($this->config(['bounds' => ['x' => 50, 'y' => 0, 'w' => 60, 'h' => 10]])));

        // Images only: no fonts needed
        $out = (new BannerConfigValidator())->validate($this->config(['maxText' => 0, 'fonts' => []]));
        $this->assertSame(1, $out['custom']['maxImage']);

        // Zone keys can't collide with layer ids
        $config = $this->config();
        $config['zones'][1]['key'] = 'layer_1';
        $this->assertArrayHasKey('config.zones.1.key', $this->errorsFor($config));
    }

    private function template(array $custom = []): BannerTemplate
    {
        return BannerTemplate::factory()->published()->create([
            'slug' => 'neon',
            'config' => (new BannerConfigValidator())->validate($this->config($custom)),
        ]);
    }

    private function order(array $layers, array $images = [])
    {
        return $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'buyer@example.com',
            'params' => json_encode(['schemaVersion' => 1, 'hue' => 0, 'zones' => [], 'layers' => $layers]),
            'images' => $images,
        ], ['Accept' => 'application/json']);
    }

    private function textLayer(string $id = 'layer_1', array $extra = []): array
    {
        return array_replace([
            'id' => $id, 'type' => 'text', 'rect' => ['x' => 10, 'y' => 20, 'w' => 50, 'h' => 10],
            'text' => "Big\nsale", 'fontId' => $this->font->id, 'size' => 6, 'color' => '#00ff88', 'align' => 'left',
            'case' => 'upper', 'letterSpacing' => 0.05, 'lineHeight' => 1.2, 'glow' => true, 'opacity' => 80,
        ], $extra);
    }

    public function test_layers_are_validated_stored_and_images_processed(): void
    {
        $template = $this->template();

        $this->order([
            $this->textLayer(),
            ['id' => 'layer_2', 'type' => 'image', 'rect' => ['x' => 60, 'y' => 60, 'w' => 30, 'h' => 15], 'scale' => 90, 'alignX' => 'right', 'alignY' => 'top'],
        ], ['layer_2' => UploadedFile::fake()->image('sticker.png', 300, 150)])->assertCreated();

        $order = BannerOrder::firstOrFail();
        $this->assertEquals([
            $this->textLayer(),
            ['id' => 'layer_2', 'type' => 'image', 'scale' => 90, 'alignX' => 'right', 'alignY' => 'top', 'rect' => ['x' => 60, 'y' => 60, 'w' => 30, 'h' => 15]],
        ], $order->params['layers']);
        Storage::disk('banners')->assertExists($order->images['layer_2']);

        // Fonts for added texts are part of the template and the snapshot
        $this->assertEqualsCanonicalizing([$this->font->id, $this->alt->id], $template->fontIds());
        $this->assertEqualsCanonicalizing([$this->font->id, $this->alt->id], array_column($order->snapshot['fonts'], 'id'));
    }

    public function test_image_layer_without_a_file_is_dropped(): void
    {
        $this->template();

        $this->order([['id' => 'layer_1', 'type' => 'image', 'rect' => ['x' => 0, 'y' => 0, 'w' => 30, 'h' => 12]]])->assertCreated();

        $this->assertArrayNotHasKey('layers', BannerOrder::firstOrFail()->params);
    }

    /** @dataProvider badLayers */
    public function test_bad_layers_are_rejected(callable $layers, string $errorKey): void
    {
        $this->template();
        $this->order($layers($this))->assertStatus(422)->assertJsonValidationErrors($errorKey);
    }

    public static function badLayers(): array
    {
        return [
            'too many texts' => [fn ($t) => [$t->textLayer('layer_1'), $t->textLayer('layer_2'), $t->textLayer('layer_3')], 'params.layers.2'],
            'duplicate id' => [fn ($t) => [$t->textLayer('layer_1'), $t->textLayer('layer_1')], 'params.layers.1.id'],
            'bad id' => [fn ($t) => [$t->textLayer('title')], 'params.layers.0'],
            'unknown type' => [fn ($t) => [['id' => 'layer_1', 'type' => 'video', 'rect' => []]], 'params.layers.0'],
            'no position' => [fn ($t) => [array_diff_key($t->textLayer(), ['rect' => 1])], 'params.layers.0.rect'],
            'outside the area' => [fn ($t) => [$t->textLayer('layer_1', ['rect' => ['x' => 0, 'y' => 75, 'w' => 50, 'h' => 10]])], 'params.layers.0.rect'],
            'font not offered' => [fn ($t) => [$t->textLayer('layer_1', ['fontId' => 999])], 'params.layers.0.fontId'],
            'text too long' => [fn ($t) => [$t->textLayer('layer_1', ['text' => str_repeat('a', 101)])], 'params.layers.0.text'],
            'size too big' => [fn ($t) => [$t->textLayer('layer_1', ['size' => 25])], 'params.layers.0.size'],
            'not a list' => [fn ($t) => ['a' => $t->textLayer()], 'params.layers'],
        ];
    }

    public function test_layers_are_dropped_when_the_template_does_not_allow_them(): void
    {
        $this->template(['enabled' => false]);

        $this->order([$this->textLayer()])->assertCreated();

        $this->assertArrayNotHasKey('layers', BannerOrder::firstOrFail()->params);
    }
}
