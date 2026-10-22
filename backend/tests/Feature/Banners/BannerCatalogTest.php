<?php

namespace Tests\Feature\Banners;

use App\Models\BannerFont;
use App\Models\BannerTemplate;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BannerCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_lists_only_published_templates(): void
    {
        $visible = BannerTemplate::factory()->published()->create(['sort_order' => 2]);
        $first = BannerTemplate::factory()->published()->create(['sort_order' => 1]);
        BannerTemplate::factory()->published()->create(['is_active' => false]);
        BannerTemplate::factory()->create(['is_active' => true]); // no video

        $this->getJson('/api/v1/banners/templates')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.slug', $first->slug)
            ->assertJsonPath('1.slug', $visible->slug)
            ->assertJsonMissingPath('0.config')
            ->assertJsonMissingPath('0.id');
    }

    public function test_template_page_has_config_and_fonts_but_no_private_paths(): void
    {
        $font = BannerFont::factory()->create();
        $template = BannerTemplate::factory()->published()->create(['config' => BannerTemplateFactory::sampleConfig($font->id)]);
        $font->delete(); // soft-deleted fonts keep working for templates that use them

        $response = $this->getJson("/api/v1/banners/templates/{$template->slug}")
            ->assertOk()
            ->assertJsonPath('config.zones.1.key', 'title')
            ->assertJsonPath('fonts.0.family', 'bf-' . $font->id)
            ->assertJsonPath('width', 1450);

        $body = $response->getContent();
        $this->assertStringNotContainsString('source', $body);
        $this->assertStringNotContainsString('templates/' . $template->uuid . '/source', $body);
        $this->assertStringNotContainsString('"path"', $body);
    }

    public function test_unpublished_template_is_404(): void
    {
        $hidden = BannerTemplate::factory()->published()->create(['is_active' => false]);

        $this->getJson("/api/v1/banners/templates/{$hidden->slug}")->assertNotFound();
        $this->getJson('/api/v1/banners/templates/no-such-template')->assertNotFound();
    }
}
