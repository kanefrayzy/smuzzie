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

/** Buyer moving and resizing zones inside the area the template allows. */
class BannerZonePositionTest extends TestCase
{
    use RefreshDatabase;

    private BannerFont $font;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Queue::fake();
        $this->font = BannerFont::factory()->create();
    }

    /** Title (26.5, 14.6, 47×9.2) movable inside the top half; logo movable anywhere, no resize. */
    private function config(array $titlePosition = []): array
    {
        $config = BannerTemplateFactory::sampleConfig($this->font->id);
        $config['zones'][1]['controls']['position'] = array_replace(
            ['enabled' => true, 'resize' => true, 'bounds' => ['x' => 0, 'y' => 0, 'w' => 100, 'h' => 50]],
            $titlePosition
        );
        $config['zones'][0]['controls']['position'] = ['enabled' => true, 'resize' => false];
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

    public function test_position_block_defaults_to_off_and_the_whole_frame(): void
    {
        $out = (new BannerConfigValidator())->validate(BannerTemplateFactory::sampleConfig($this->font->id));

        $this->assertSame(
            ['enabled' => false, 'resize' => false, 'bounds' => ['x' => 0.0, 'y' => 0.0, 'w' => 100.0, 'h' => 100.0]],
            $out['zones'][1]['controls']['position']
        );
        $this->assertFalse($out['zones'][0]['controls']['position']['enabled']);
    }

    public function test_the_area_must_contain_the_zone_while_moving_is_on(): void
    {
        $bounds = ['x' => 0, 'y' => 20, 'w' => 100, 'h' => 30]; // starts below the title's top (14.6)
        $errors = $this->errorsFor($this->config(['bounds' => $bounds]));
        $this->assertArrayHasKey('config.zones.1.controls.position.bounds', $errors);

        // Off: widened to include the zone instead
        $out = (new BannerConfigValidator())->validate($this->config(['enabled' => false, 'bounds' => $bounds]));
        $this->assertEquals(['x' => 0, 'y' => 14.6, 'w' => 100, 'h' => 35.4], $out['zones'][1]['controls']['position']['bounds']);

        $errors = $this->errorsFor($this->config(['bounds' => ['x' => 10, 'y' => 0, 'w' => 95, 'h' => 50]]));
        $this->assertArrayHasKey('config.zones.1.controls.position.bounds', $errors);
    }

    private function order(array $zones)
    {
        BannerTemplate::factory()->published()->create([
            'slug' => 'neon',
            'config' => (new BannerConfigValidator())->validate($this->config()),
        ]);

        return $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'buyer@example.com',
            'params' => json_encode(['schemaVersion' => 1, 'hue' => 0, 'zones' => $zones]),
        ], ['Accept' => 'application/json']);
    }

    public function test_moved_and_resized_zones_are_stored(): void
    {
        $this->order([
            'title' => ['rect' => ['x' => 2.12345, 'y' => 30, 'w' => 60, 'h' => 20]],
            // No resizing for the logo: its own size is kept whatever was sent
            'logo' => ['rect' => ['x' => 0, 'y' => 90, 'w' => 99, 'h' => 99]],
        ])->assertCreated();

        $zones = BannerOrder::firstOrFail()->params['zones'];
        $this->assertEquals(['x' => 2.123, 'y' => 30, 'w' => 60, 'h' => 20], $zones['title']['rect']);
        $this->assertEquals(['x' => 0, 'y' => 90, 'w' => 40, 'h' => 5.6], $zones['logo']['rect']);
    }

    /** @dataProvider badRects */
    public function test_rects_outside_the_area_are_rejected(array $zones, string $key): void
    {
        $this->order($zones)->assertStatus(422)->assertJsonValidationErrors($key);
    }

    public static function badRects(): array
    {
        return [
            'below the allowed area' => [['title' => ['rect' => ['x' => 0, 'y' => 45, 'w' => 47, 'h' => 9.2]]], 'params.zones.title.rect'],
            'too small' => [['title' => ['rect' => ['x' => 0, 'y' => 0, 'w' => 1, 'h' => 9.2]]], 'params.zones.title.rect'],
            'off the left edge' => [['title' => ['rect' => ['x' => -1, 'y' => 0, 'w' => 47, 'h' => 9.2]]], 'params.zones.title.rect'],
            'logo pushed past the bottom' => [['logo' => ['rect' => ['x' => 0, 'y' => 96, 'w' => 40, 'h' => 5.6]]], 'params.zones.logo.rect'],
            'not numbers' => [['title' => ['rect' => ['x' => '0', 'y' => 0, 'w' => 47, 'h' => 9.2]]], 'params.zones.title.rect'],
            'not an object' => [['title' => ['rect' => 'top']], 'params.zones.title.rect'],
        ];
    }

    public function test_position_is_ignored_where_moving_is_off(): void
    {
        BannerTemplate::factory()->published()->create(['slug' => 'neon', 'config' => BannerTemplateFactory::sampleConfig($this->font->id)]);

        $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'buyer@example.com',
            'params' => json_encode(['zones' => ['button' => ['text' => 'Go', 'rect' => ['x' => 0, 'y' => 0, 'w' => 100, 'h' => 100]]]]),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame(['text' => 'Go'], BannerOrder::firstOrFail()->params['zones']['button']);
    }
}
