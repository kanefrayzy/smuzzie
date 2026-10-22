<?php

namespace Tests\Feature\Banners;

use App\Enums\BannerOrderStatus;
use App\Jobs\RenderBannerOrder;
use App\Models\BannerOrder;
use App\Models\User;
use App\Services\Banners\BannerOrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

/** Status transitions, admin actions and signed downloads. */
class BannerOrderFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Queue::fake();
    }

    private function asAdmin(): static
    {
        return $this->withHeader('Authorization', 'Bearer ' . JWTAuth::fromUser(User::factory()->admin()->create()));
    }

    private function readyOrderWithFiles(): BannerOrder
    {
        $order = BannerOrder::factory()->ready()->create();
        $result = [
            'mp4' => ['path' => "orders/{$order->token}/banner.mp4", 'size' => 9],
            'gif' => ['path' => "orders/{$order->token}/banner.gif", 'size' => 9],
        ];
        Storage::disk('banners')->put($result['mp4']['path'], 'MP4-BYTES');
        Storage::disk('banners')->put($result['gif']['path'], 'GIF-BYTES');
        $order->update(['result' => $result]);
        return $order;
    }

    // ─── markPaid / rerender ───────────────────────────────────

    public function test_mark_paid_is_idempotent(): void
    {
        $order = BannerOrder::factory()->create();
        $service = app(BannerOrderService::class);

        $this->assertTrue($service->markPaid($order, 'webhook', 'pay_123'));
        $this->assertFalse($service->markPaid($order, 'webhook', 'pay_123')); // repeated webhook

        $order->refresh();
        $this->assertSame(BannerOrderStatus::Queued, $order->status);
        $this->assertSame('webhook', $order->payment_provider);
        $this->assertSame('pay_123', $order->payment_reference);
        Queue::assertPushed(RenderBannerOrder::class, 1);
    }

    public function test_admin_confirms_payment_once(): void
    {
        $order = BannerOrder::factory()->create();

        $this->asAdmin()->postJson("/api/v1/admin/banner-orders/{$order->id}/mark-paid")
            ->assertOk()->assertJsonPath('status', 'queued')->assertJsonPath('payment_provider', 'manual');
        $this->postJson("/api/v1/admin/banner-orders/{$order->id}/mark-paid")->assertStatus(409);

        Queue::assertPushed(RenderBannerOrder::class, 1);
    }

    public function test_rerender_only_from_ready_or_failed(): void
    {
        $pending = BannerOrder::factory()->create();
        $ready = BannerOrder::factory()->ready()->create();
        $failed = BannerOrder::factory()->create(['status' => BannerOrderStatus::Failed, 'paid_at' => now(), 'error' => 'boom']);

        $this->asAdmin()->postJson("/api/v1/admin/banner-orders/{$pending->id}/rerender")->assertStatus(409);
        $this->postJson("/api/v1/admin/banner-orders/{$ready->id}/rerender")->assertOk()->assertJsonPath('status', 'queued');
        $this->postJson("/api/v1/admin/banner-orders/{$failed->id}/rerender")->assertOk()->assertJsonPath('error', null);

        Queue::assertPushed(RenderBannerOrder::class, 2);
    }

    public function test_admin_list_hides_test_orders_by_default_and_filters_by_status(): void
    {
        BannerOrder::factory()->create();
        BannerOrder::factory()->ready()->create();
        BannerOrder::factory()->ready()->create(['is_test' => true, 'email' => null]);

        $this->asAdmin()->getJson('/api/v1/admin/banner-orders')->assertOk()->assertJsonPath('orders.total', 2);
        $this->getJson('/api/v1/admin/banner-orders?include_tests=1')->assertJsonPath('orders.total', 3);
        $this->getJson('/api/v1/admin/banner-orders?status=ready')->assertJsonPath('orders.total', 1);
        $this->getJson('/api/v1/admin/banner-orders?status=bogus')->assertStatus(422);
    }

    // ─── Signed downloads ──────────────────────────────────────

    public function test_ready_order_gets_working_signed_download_links(): void
    {
        $order = $this->readyOrderWithFiles();

        $links = $this->getJson("/api/v1/banners/orders/{$order->token}")->assertOk()->json('downloads');
        $this->assertSame(['mp4', 'gif'], array_keys($links));
        $this->assertStringContainsString('signature=', $links['mp4']);

        $response = $this->get($links['mp4']);
        $response->assertOk();
        $this->assertSame('MP4-BYTES', $response->streamedContent());
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));
    }

    public function test_download_without_or_with_tampered_signature_is_rejected(): void
    {
        $order = $this->readyOrderWithFiles();
        $plain = "/api/v1/banners/orders/{$order->token}/download/mp4";

        $this->get($plain)->assertForbidden();

        $signed = URL::temporarySignedRoute('banners.download', now()->addDay(), ['token' => $order->token, 'format' => 'mp4']);
        $this->get(str_replace('/download/mp4', '/download/gif', $signed))->assertForbidden(); // format swapped

        $other = $this->readyOrderWithFiles();
        $this->get(str_replace($order->token, $other->token, $signed))->assertForbidden(); // token swapped

        $this->get($signed . 'x')->assertForbidden();
    }

    public function test_download_links_expire_after_seven_days(): void
    {
        $order = $this->readyOrderWithFiles();
        $link = $this->getJson("/api/v1/banners/orders/{$order->token}")->json('downloads.mp4');

        $this->travel(6)->days();
        $this->get($link)->assertOk();

        $this->travel(2)->days();
        $this->get($link)->assertForbidden();
    }

    public function test_no_links_before_ready_or_after_files_were_purged(): void
    {
        $pending = BannerOrder::factory()->create();
        $this->getJson("/api/v1/banners/orders/{$pending->token}")->assertJsonPath('downloads', null);

        $order = $this->readyOrderWithFiles();
        $link = $this->getJson("/api/v1/banners/orders/{$order->token}")->json('downloads.mp4');
        $order->update(['result_purged_at' => now()]);

        $this->getJson("/api/v1/banners/orders/{$order->token}")
            ->assertJsonPath('downloads', null)
            ->assertJsonPath('files_expired', true);
        $this->get($link)->assertNotFound(); // a still-valid signature doesn't bring purged files back
    }

    public function test_admin_order_details_include_logo_link_but_not_private_paths(): void
    {
        $order = BannerOrder::factory()->create(['images' => ['logo' => 'orders/x/image-logo.png']]);
        Storage::disk('banners')->put('orders/x/image-logo.png', 'PNG');

        $json = $this->asAdmin()->getJson("/api/v1/admin/banner-orders/{$order->id}")->assertOk();
        $this->get($json->json('images.logo'))->assertOk();
        $this->assertStringNotContainsString('source_path', $json->getContent());
    }
}
