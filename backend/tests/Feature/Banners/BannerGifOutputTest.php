<?php

namespace Tests\Feature\Banners;

use App\Models\BannerTemplate;
use App\Services\Banners\BannerConfigValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** GIF output: 1000 px by default, never wider than the template. */
class BannerGifOutputTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_width_is_1000_capped_by_the_template(): void
    {
        $validator = new BannerConfigValidator();

        $this->assertSame(1000, $validator->validateOutputs([], null)['gif']['width']);
        $this->assertSame(1000, $validator->validateOutputs([], 1450)['gif']['width']);
        $this->assertSame(640, $validator->validateOutputs(['gif' => ['enabled' => true]], 640)['gif']['width']);
        // The admin can still pick any width up to the cap
        $this->assertSame(720, $validator->validateOutputs(['gif' => ['enabled' => true, 'width' => 720]], 1450)['gif']['width']);
    }

    public function test_migration_moves_templates_off_the_old_default(): void
    {
        $gif = fn (int $width) => ['mp4' => true, 'gif' => ['enabled' => true, 'width' => $width, 'fps' => 15]];
        $wide = BannerTemplate::factory()->create(['width' => 1450, 'outputs' => $gif(600)]);
        $narrow = BannerTemplate::factory()->create(['width' => 800, 'outputs' => $gif(600)]);
        $noMedia = BannerTemplate::factory()->create(['width' => null, 'outputs' => $gif(600)]);
        $custom = BannerTemplate::factory()->create(['width' => 1450, 'outputs' => $gif(480)]);

        $migration = require database_path('migrations/2026_10_24_000001_bump_banner_gif_width.php');
        $migration->up();

        $this->assertSame(1000, $wide->fresh()->outputs['gif']['width']);
        $this->assertSame(800, $narrow->fresh()->outputs['gif']['width']);
        $this->assertSame(1000, $noMedia->fresh()->outputs['gif']['width']);
        $this->assertSame(480, $custom->fresh()->outputs['gif']['width']);
        $this->assertTrue($wide->fresh()->outputs['gif']['enabled']);

        $migration->down();
        $this->assertSame(600, $wide->fresh()->outputs['gif']['width']);
        $this->assertSame(600, $narrow->fresh()->outputs['gif']['width']);
        $this->assertSame(480, $custom->fresh()->outputs['gif']['width']);
    }
}
