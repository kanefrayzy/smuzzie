<?php

namespace Tests\Feature\Banners;

use App\Enums\BannerOrderStatus;
use App\Enums\BannerTemplateStatus;
use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BannerModelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_template_json_never_exposes_file_paths(): void
    {
        $template = BannerTemplate::factory()->published()->create();
        $json = $template->toArray();

        foreach (['upload_path', 'source_path', 'preview_path', 'poster_path'] as $hidden) {
            $this->assertArrayNotHasKey($hidden, $json);
        }
        $this->assertStringEndsWith('.mp4', $json['preview_url']);
        $this->assertStringEndsWith('.webp', $json['poster_url']);
        $this->assertTrue(Str::isUuid($json['uuid']));
    }

    public function test_published_scope_needs_active_and_processed(): void
    {
        $published = BannerTemplate::factory()->published()->create();
        BannerTemplate::factory()->published()->create(['is_active' => false]);
        BannerTemplate::factory()->create(['is_active' => true]); // no video yet
        BannerTemplate::factory()->published()->create(['processing_status' => BannerTemplateStatus::Failed]);
        $deleted = BannerTemplate::factory()->published()->create();
        $deleted->delete();

        $this->assertEquals([$published->id], BannerTemplate::published()->pluck('id')->all());
        $this->assertTrue($published->isPublished());
    }

    public function test_template_font_ids_come_from_text_zones(): void
    {
        $font = BannerFont::factory()->create();
        $template = BannerTemplate::factory()->create([
            'config' => \Database\Factories\BannerTemplateFactory::sampleConfig($font->id),
        ]);

        $this->assertSame([$font->id], $template->fontIds());
    }

    public function test_font_exposes_css_family_and_url_but_not_path(): void
    {
        $font = BannerFont::factory()->create();
        $json = $font->toArray();

        $this->assertSame('bf-' . $font->id, $json['family']);
        $this->assertArrayNotHasKey('path', $json);
        $this->assertStringEndsWith('.woff2', $json['url']);
    }

    public function test_order_gets_uuid_token_and_default_status(): void
    {
        $order = BannerOrder::factory()->create();

        $this->assertTrue(Str::isUuid($order->token));
        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);
        $this->assertArrayNotHasKey('ip', $order->toArray());
    }

    public function test_result_formats_only_when_ready_and_not_purged(): void
    {
        $order = BannerOrder::factory()->ready()->create();
        $this->assertSame(['mp4', 'gif'], $order->resultFormats());

        $order->update(['result_purged_at' => now()]);
        $this->assertSame([], $order->resultFormats());

        $pending = BannerOrder::factory()->create();
        $this->assertSame([], $pending->resultFormats());
    }

    public function test_deleting_template_keeps_orders(): void
    {
        $order = BannerOrder::factory()->create();
        $order->template->delete(); // soft delete

        $fresh = $order->fresh();
        $this->assertNotNull($fresh->template_id);
        $this->assertNotNull($fresh->template); // relation includes trashed templates
    }

    public function test_status_enum_helpers(): void
    {
        $this->assertFalse(BannerOrderStatus::PendingPayment->isPaid());
        $this->assertTrue(BannerOrderStatus::Queued->isPaid());
        $this->assertTrue(BannerOrderStatus::Rendering->isInProgress());
        $this->assertTrue(BannerOrderStatus::Failed->canRerender());
        $this->assertFalse(BannerOrderStatus::Queued->canRerender());
    }
}
