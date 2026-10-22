<?php

namespace Tests\Feature\Banners;

use App\Enums\BannerOrderStatus;
use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BannerCleanupTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Storage::fake('public');
    }

    private function orderWithFiles(array $attrs): BannerOrder
    {
        $order = BannerOrder::factory()->create($attrs);
        Storage::disk('banners')->put("orders/{$order->token}/image-logo.png", 'PNG');
        return $order;
    }

    private function age(string $path, int $seconds, string $disk = 'banners'): void
    {
        touch(Storage::disk($disk)->path($path), time() - $seconds);
    }

    public function test_removes_old_unpaid_and_test_orders_but_keeps_paid_and_recent(): void
    {
        $oldUnpaid = $this->orderWithFiles(['created_at' => now()->subDays(8)]);
        $newUnpaid = $this->orderWithFiles(['created_at' => now()->subDays(2)]);
        $oldTest = $this->orderWithFiles(['is_test' => true, 'status' => BannerOrderStatus::Ready, 'created_at' => now()->subDays(8)]);
        $oldPaid = $this->orderWithFiles(['status' => BannerOrderStatus::Failed, 'paid_at' => now()->subDays(20), 'created_at' => now()->subDays(20)]);

        $this->artisan('banners:cleanup')->assertSuccessful();

        $this->assertModelMissing($oldUnpaid);
        $this->assertModelMissing($oldTest);
        Storage::disk('banners')->assertMissing("orders/{$oldUnpaid->token}/image-logo.png");
        $this->assertModelExists($newUnpaid);
        $this->assertModelExists($oldPaid);
        Storage::disk('banners')->assertExists("orders/{$oldPaid->token}/image-logo.png"); // needed to render again
    }

    public function test_purges_result_files_after_retention_and_keeps_the_order(): void
    {
        $old = BannerOrder::factory()->ready()->create(['ready_at' => now()->subDays(31)]);
        $fresh = BannerOrder::factory()->ready()->create(['ready_at' => now()->subDays(5)]);
        foreach ([$old, $fresh] as $o) {
            $o->update(['result' => ['mp4' => ['path' => "orders/{$o->token}/banner.mp4", 'size' => 1]]]);
            Storage::disk('banners')->put("orders/{$o->token}/banner.mp4", 'MP4');
        }

        $this->artisan('banners:cleanup')->assertSuccessful();

        Storage::disk('banners')->assertMissing("orders/{$old->token}/banner.mp4");
        $this->assertNotNull($old->fresh()->result_purged_at);
        $this->assertSame([], $old->fresh()->resultFormats());
        Storage::disk('banners')->assertExists("orders/{$fresh->token}/banner.mp4");
        $this->assertNull($fresh->fresh()->result_purged_at);
    }

    public function test_removes_stale_temp_folders_and_unreferenced_template_files(): void
    {
        $template = BannerTemplate::factory()->published()->create();
        $current = $template->source_path;
        $ordered = "templates/{$template->uuid}/source-0-old.mp4";
        $orphan = "templates/{$template->uuid}/source-0-orphan.mp4";
        $oldPreview = "banners/templates/{$template->uuid}/preview-0-old.mp4";
        foreach ([$current, $ordered, $orphan] as $p) {
            Storage::disk('banners')->put($p, 'V');
            $this->age($p, 3 * 86400);
        }
        Storage::disk('public')->put($template->preview_path, 'P');
        Storage::disk('public')->put($oldPreview, 'P');
        $this->age($oldPreview, 3 * 86400, 'public');
        $this->age($template->preview_path, 3 * 86400, 'public');
        BannerOrder::factory()->create(['paid_at' => now(), 'status' => BannerOrderStatus::Ready, 'snapshot' => ['media' => ['source_path' => $ordered]]]);

        Storage::disk('banners')->put('tmp/old-1/job.json', '{}');
        Storage::disk('banners')->put('tmp/new-1/job.json', '{}');
        touch(Storage::disk('banners')->path('tmp/old-1'), time() - 2 * 86400);

        $this->artisan('banners:cleanup')->assertSuccessful();

        Storage::disk('banners')->assertExists([$current, $ordered]);
        Storage::disk('banners')->assertMissing($orphan);
        Storage::disk('public')->assertExists($template->preview_path);
        Storage::disk('public')->assertMissing($oldPreview);
        $this->assertSame(['tmp/new-1'], Storage::disk('banners')->directories('tmp'));
    }

    public function test_deleted_fonts_are_removed_only_when_nothing_uses_them(): void
    {
        $unused = BannerFont::factory()->create();
        $inOrder = BannerFont::factory()->create();
        Storage::disk('public')->put($unused->path, 'F');
        Storage::disk('public')->put($inOrder->path, 'F');
        BannerOrder::factory()->create(['snapshot' => ['fonts' => [['id' => $inOrder->id, 'path' => $inOrder->path]]]]);
        $unused->delete();
        $inOrder->delete();

        $this->artisan('banners:cleanup')->assertSuccessful();

        $this->assertNull(BannerFont::withTrashed()->find($unused->id));
        Storage::disk('public')->assertMissing($unused->path);
        $this->assertNotNull(BannerFont::withTrashed()->find($inOrder->id));
        Storage::disk('public')->assertExists($inOrder->path);
    }

    public function test_dry_run_changes_nothing(): void
    {
        $old = $this->orderWithFiles(['created_at' => now()->subDays(8)]);

        $this->artisan('banners:cleanup --dry-run')->expectsOutputToContain('[dry run] unpaid orders: 1')->assertSuccessful();

        $this->assertModelExists($old);
    }

    public function test_cleanup_is_scheduled_daily(): void
    {
        $events = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())
            ->filter(fn ($e) => str_contains($e->command ?? '', 'banners:cleanup'));

        $this->assertCount(1, $events);
        $this->assertSame('10 4 * * *', $events->first()->expression);
    }
}
