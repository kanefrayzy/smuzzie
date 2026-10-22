<?php

namespace Tests\Feature\Banners\Payments;

use App\Enums\BannerOrderStatus;
use App\Enums\BannerPaymentStatus;
use App\Jobs\RenderBannerOrder;
use App\Models\BannerOrder;
use App\Models\BannerPayment;
use App\Models\User;
use App\Services\Payments\BannerPaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

/** Crypto checkout: picker, deposit address, IPN verification, payment rules, sync. */
class BannerPaymentTest extends TestCase
{
    use RefreshDatabase;

    private const IPN_IP = '45.155.121.88';

    private FakeWestWallet $ww;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Cache::flush();
        config([
            'app.url' => 'https://shop.test',
            'services.westwallet.public_key' => 'test-public',
            'services.westwallet.private_key' => 'test-private',
            'services.westwallet.ipn_url' => null,
            'services.westwallet.ipn_secret' => null,
            'services.westwallet.ipn_ips' => [self::IPN_IP],
            'banners.payments.price_lock_minutes' => 30,
            'banners.payments.late_grace_minutes' => 15,
            'banners.payments.underpay_tolerance_percent' => 0.5,
            'banners.payments.late_policy' => 'requote',
        ]);
        $this->ww = FakeWestWallet::install();
    }

    private function order(float $amount = 15): BannerOrder
    {
        return BannerOrder::factory()->create(['amount' => $amount]);
    }

    private function select(BannerOrder $order, string $method)
    {
        return $this->postJson("/api/v1/banners/orders/{$order->token}/payment", ['method' => $method]);
    }

    private function ipn(array $body, string $ip = self::IPN_IP, string $query = '')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->post('/api/v1/payments/westwallet/ipn' . $query, $body); // form-encoded, like WestWallet
    }

    /** Create a USDT TRC-20 payment and a completed transaction of $amount to it. */
    private function paidTx(BannerOrder $order, string $amount, int $id = 501, string $status = 'completed'): BannerPayment
    {
        $this->select($order, 'usdt-trc20')->assertOk();
        $payment = $order->payments()->first();
        $this->ww->tx($id, 'USDTTRC', $amount, $payment->address, $payment->label, $status);
        return $payment;
    }

    // ─── availability and picker ───────────────────────────────

    public function test_unconfigured_gateway_shows_payments_unavailable(): void
    {
        config(['services.westwallet.private_key' => null]);
        $order = $this->order();

        $this->getJson('/api/v1/banners/payments/availability')
            ->assertOk()->assertJson(['payments_available' => false, 'auto_approve' => false]);
        $this->getJson("/api/v1/banners/orders/{$order->token}/payment-methods")
            ->assertOk()->assertJson(['available' => false, 'reason' => 'not_configured']);
        $this->select($order, 'usdt-trc20')->assertStatus(503)->assertJsonPath('reason', 'not_configured');
        Http::assertNothingSent();
    }

    public function test_gateway_down_makes_the_picker_unavailable_instead_of_failing(): void
    {
        $this->ww->down = true;
        $order = $this->order();

        $this->getJson("/api/v1/banners/orders/{$order->token}/payment-methods")
            ->assertOk()->assertJson(['available' => false, 'reason' => 'unavailable']);
        $this->select($order, 'usdt-trc20')->assertStatus(503);
    }

    public function test_picker_lists_only_currencies_the_gateway_accepts_with_amounts_and_minimums(): void
    {
        $order = $this->order(15);

        $res = $this->getJson("/api/v1/banners/orders/{$order->token}/payment-methods")->assertOk()->assertJsonPath('available', true);
        $methods = collect($res->json('methods'))->keyBy('key');

        $this->assertSame('15', $methods['usdt-trc20']['approx_amount']);
        $this->assertTrue($methods['usdt-trc20']['available']);
        // ERC-20 minimum deposit is 20 USDT on the fake: shown, but disabled with the reason
        $this->assertFalse($methods['usdt-erc20']['available']);
        $this->assertStringContainsString('Minimum deposit is 20 USDT', $methods['usdt-erc20']['unavailable_reason']);
        $this->assertSame('0.0001875', $methods['btc']['approx_amount']);        // 15 / 80000
        $this->assertSame('12', $methods['xrp']['approx_amount']);               // 15 / 1.25 via the inverse rate
        $this->assertTrue($methods['xrp']['requires_tag']);
        $this->assertSame('10', $methods['ton']['approx_amount']);               // TON is GRAM in the rates
        $this->assertArrayNotHasKey('usdt-bep20', $methods->all());              // receive_active = false
        $this->assertArrayNotHasKey('ltc', $methods->all());                     // not offered by the gateway
        $this->assertSame('tron', $methods['usdt-trc20']['network_icon']);
    }

    // ─── address generation ────────────────────────────────────

    public function test_choosing_a_method_creates_one_address_and_reuses_it(): void
    {
        $order = $this->order(15);

        $this->select($order, 'usdt-trc20')->assertOk()
            ->assertJson(['method' => 'usdt-trc20', 'coin' => 'USDT', 'network' => 'TRC20', 'amount' => '15', 'status' => 'awaiting', 'expired' => false])
            ->assertJsonPath('address', 'TTestTronAddress1')
            ->assertJsonPath('dest_tag', null);

        $label = substr(str_replace('-', '', $order->token), 0, 30);
        Http::assertSent(function (Request $r) use ($label) {
            if (!str_ends_with($r->url(), '/address/generate')) {
                return false;
            }
            return $r['currency'] === 'USDTTRC' && $r['label'] === $label && strlen($r['label']) === 30
                && $r['ipn_url'] === 'https://shop.test/api/v1/payments/westwallet/ipn';
        });

        // Clicking again, or reloading, reuses the address
        $this->select($order, 'usdt-trc20')->assertOk()->assertJsonPath('address', 'TTestTronAddress1');
        $this->assertSame(1, $this->ww->generated);
        $this->assertSame(1, $order->payments()->count());

        // The order status (polled by the order page) carries the payment
        $this->getJson("/api/v1/banners/orders/{$order->token}")->assertOk()
            ->assertJsonPath('payment.address', 'TTestTronAddress1')
            ->assertJsonPath('payment.status', 'awaiting');
    }

    public function test_switching_coins_keeps_each_address_and_the_order_page_resumes_the_last_choice(): void
    {
        $order = $this->order(15);
        $this->select($order, 'usdt-trc20')->assertOk();
        $this->travel(1)->seconds();
        $this->select($order, 'btc')->assertOk()->assertJson(['amount' => '0.0001875', 'address' => 'bc1qtestaddress2']);
        $this->getJson("/api/v1/banners/orders/{$order->token}")->assertJsonPath('payment.method', 'btc');

        $this->travel(1)->seconds();
        $this->select($order, 'usdt-trc20')->assertOk()->assertJsonPath('address', 'TTestTronAddress1');
        $this->getJson("/api/v1/banners/orders/{$order->token}")->assertJsonPath('payment.method', 'usdt-trc20');
        $this->assertSame(2, $this->ww->generated);
    }

    public function test_network_with_a_destination_tag_returns_it(): void
    {
        $order = $this->order(15);
        $this->select($order, 'xrp')->assertOk()->assertJson(['address' => 'rTestXrpAddress1', 'dest_tag' => '77551', 'amount' => '12']);
    }

    public function test_bad_requests_are_refused(): void
    {
        $order = $this->order(15);
        $this->select($order, 'nope')->assertStatus(422)->assertJsonPath('reason', 'unknown_method');
        $this->select($order, 'usdt-erc20')->assertStatus(422)->assertJsonPath('reason', 'below_minimum');
        $this->select($order, 'usdt-bep20')->assertStatus(422)->assertJsonPath('reason', 'inactive');
        $this->postJson('/api/v1/banners/orders/00000000-0000-0000-0000-000000000000/payment', ['method' => 'btc'])->assertNotFound();

        $paid = BannerOrder::factory()->ready()->create();
        $this->select($paid, 'btc')->assertStatus(409);
        $this->assertSame(0, $this->ww->generated);
    }

    public function test_address_count_per_order_is_capped(): void
    {
        config(['banners.payments.max_addresses_per_order' => 2]);
        $order = $this->order(15);
        $this->select($order, 'usdt-trc20')->assertOk();
        $this->select($order, 'btc')->assertOk();
        $this->select($order, 'xrp')->assertStatus(422)->assertJsonPath('reason', 'too_many');
    }

    public function test_choosing_a_method_is_rate_limited(): void
    {
        config(['banners.rate_limits.payment_per_minute' => 3]);
        $order = $this->order(15);
        for ($i = 0; $i < 3; $i++) {
            $this->select($order, 'usdt-trc20')->assertOk();
        }
        $this->select($order, 'usdt-trc20')->assertStatus(429);
    }

    public function test_expired_quote_is_renewed_for_the_same_address(): void
    {
        $order = $this->order(15);
        $this->select($order, 'btc')->assertOk()->assertJsonPath('amount', '0.0001875');

        $this->travel(31)->minutes();
        $this->getJson("/api/v1/banners/orders/{$order->token}")->assertJsonPath('payment.expired', true);

        $this->ww->rates[0]['rate'] = 75000;
        Cache::flush();
        $this->select($order, 'btc')->assertOk()
            ->assertJson(['address' => 'bc1qtestaddress1', 'amount' => '0.0002', 'expired' => false]);
        $this->assertSame(1, $this->ww->generated);
    }

    // ─── IPN verification ──────────────────────────────────────

    public function test_valid_ipn_is_verified_through_the_api_and_marks_the_order_paid_once(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15');

        $body = ['id' => 501, 'amount' => 15, 'address' => $payment->address, 'label' => $payment->label, 'currency' => 'USDTTRC', 'status' => 'completed'];
        $this->ipn($body)->assertOk();
        $this->ipn($body)->assertOk(); // duplicate notification

        $order->refresh();
        $this->assertSame(BannerOrderStatus::Queued, $order->status);
        $this->assertSame('westwallet', $order->payment_provider);
        $this->assertSame('501', $order->payment_reference);
        $this->assertSame(BannerPaymentStatus::Paid, $payment->fresh()->status);
        $this->assertSame(1, $payment->transactions()->count());
        Queue::assertPushed(RenderBannerOrder::class, 1);
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/wallet/transaction') && $r['id'] === 501);

        $this->getJson("/api/v1/banners/orders/{$order->token}")
            ->assertJsonPath('status', 'queued')->assertJsonPath('payment.status', 'paid');
    }

    public function test_forged_ipn_from_another_ip_is_rejected_without_any_lookup(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15');

        $this->ipn(['id' => 501, 'status' => 'completed'], '203.0.113.9')->assertForbidden();

        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);
        Http::assertNotSent(fn (Request $r) => str_ends_with($r->url(), '/wallet/transaction'));
    }

    public function test_ipn_body_is_never_trusted(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15', 501, 'pending'); // the API says: still pending

        $this->ipn(['id' => 501, 'amount' => 15, 'status' => 'completed', 'label' => $payment->label, 'currency' => 'USDTTRC'])->assertOk();

        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);
        $this->assertSame(BannerPaymentStatus::Confirming, $payment->fresh()->status);
        $this->getJson("/api/v1/banners/orders/{$order->token}")
            ->assertJsonPath('payment.status', 'confirming')->assertJsonPath('payment.pending', '15');

        // The same id becomes completed in the API later
        $this->ww->transactions['501']['status'] = 'completed';
        $this->ipn(['id' => 501])->assertOk();
        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
    }

    public function test_ipn_for_an_unknown_transaction_changes_nothing(): void
    {
        $order = $this->order(15);
        $this->paidTx($order, '15');

        $this->ipn(['id' => 999, 'status' => 'completed'])->assertOk();
        $this->ipn(['status' => 'completed'])->assertStatus(400);

        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);
    }

    public function test_transaction_with_wrong_label_currency_address_or_direction_is_ignored(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15');

        $this->ww->tx(601, 'USDTTRC', '15', $payment->address, 'someotherlabel');
        $this->ww->tx(602, 'BTC', '15', $payment->address, $payment->label);
        $this->ww->tx(603, 'USDTTRC', '15', 'TSomeoneElsesAddress', $payment->label);
        $this->ww->tx(604, 'USDTTRC', '15', $payment->address, $payment->label);
        $this->ww->transactions['604']['type'] = 'send';
        foreach ([601, 602, 603, 604] as $id) {
            $this->ipn(['id' => $id])->assertOk();
        }

        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);
        $this->assertSame(0, $payment->transactions()->count());
        Queue::assertNothingPushed();
    }

    public function test_currency_aliases_from_the_gateway_are_accepted(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15');
        $this->ww->transactions['501']['currency'] = 'USDTTRC20';

        $this->ipn(['id' => 501])->assertOk();
        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
    }

    public function test_ipn_secret_is_required_when_configured(): void
    {
        config(['services.westwallet.ipn_secret' => 's3cret']);
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15');

        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/address/generate')
            && $r['ipn_url'] === 'https://shop.test/api/v1/payments/westwallet/ipn?secret=s3cret');

        $this->ipn(['id' => 501])->assertForbidden();
        $this->ipn(['id' => 501], self::IPN_IP, '?secret=wrong')->assertForbidden();
        $this->ipn(['id' => 501], self::IPN_IP, '?secret=s3cret')->assertOk();
        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
    }

    public function test_gateway_error_during_verification_asks_for_a_retry(): void
    {
        $order = $this->order(15);
        $this->paidTx($order, '15');
        $this->ww->down = true;

        $this->ipn(['id' => 501])->assertStatus(503);
        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);
    }

    // ─── amount rules ──────────────────────────────────────────

    public function test_underpayment_waits_for_the_rest_on_the_same_address(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '10');

        $this->ipn(['id' => 501])->assertOk();
        $this->assertSame(BannerPaymentStatus::Underpaid, $payment->fresh()->status);
        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);
        $this->getJson("/api/v1/banners/orders/{$order->token}")
            ->assertJsonPath('payment.received', '10')->assertJsonPath('payment.remaining', '5');

        $this->ww->tx(502, 'USDTTRC', '5', $payment->address, $payment->label);
        $this->ipn(['id' => 502])->assertOk();

        $this->assertSame(BannerPaymentStatus::Paid, $payment->fresh()->status);
        $this->assertSame('502', $order->fresh()->payment_reference);
        Queue::assertPushed(RenderBannerOrder::class, 1);
    }

    public function test_small_shortfall_within_the_tolerance_counts_as_paid(): void
    {
        $order = $this->order(100);
        $payment = $this->paidTx($order, '99.6'); // 0.4% short, tolerance 0.5%

        $this->ipn(['id' => 501])->assertOk();
        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
    }

    public function test_overpayment_is_accepted_and_recorded(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '20');

        $this->ipn(['id' => 501])->assertOk();

        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
        $this->assertSame('5', $payment->fresh()->meta['overpaid']);
    }

    public function test_late_payment_in_a_stablecoin_keeps_the_quote(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15');
        $this->travel(2)->hours();

        $this->ipn(['id' => 501])->assertOk();
        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
    }

    public function test_late_payment_is_requoted_at_the_current_rate(): void
    {
        $order = $this->order(15);
        $this->select($order, 'btc')->assertOk(); // 0.0001875 BTC at 80 000
        $payment = $order->payments()->first();
        $this->ww->tx(701, 'BTC', '0.0001875', $payment->address, $payment->label);

        // After lock + grace, BTC fell to 70 000: 0.0001875 BTC = 13.13 USD < 15
        $this->travel(50)->minutes();
        $this->ww->rates[0]['rate'] = 70000;
        Cache::flush();
        $this->ipn(['id' => 701])->assertOk();

        $payment->refresh();
        $this->assertSame(BannerPaymentStatus::Review, $payment->status);
        $this->assertSame('late_short', $payment->meta['review_reason']);
        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);

        // The admin can still confirm it by hand
        $admin = User::factory()->admin()->create();
        $this->withHeader('Authorization', 'Bearer ' . JWTAuth::fromUser($admin))
            ->getJson("/api/v1/admin/banner-orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('payments.0.status', 'review')
            ->assertJsonPath('payments.0.address', $payment->address)
            ->assertJsonPath('payments.0.transactions.0.provider_id', '701')
            ->assertJsonPath('payments.0.review_reason', 'late_short');
        $this->postJson("/api/v1/admin/banner-orders/{$order->id}/mark-paid")->assertOk()->assertJsonPath('status', 'queued');
    }

    public function test_late_payment_worth_the_price_is_accepted(): void
    {
        $order = $this->order(15);
        $this->select($order, 'btc')->assertOk();
        $payment = $order->payments()->first();
        $this->ww->tx(702, 'BTC', '0.0001875', $payment->address, $payment->label);

        $this->travel(50)->minutes(); // rate unchanged
        $this->ipn(['id' => 702])->assertOk();

        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
    }

    public function test_payment_detected_before_the_deadline_is_on_time_even_if_confirmed_later(): void
    {
        $order = $this->order(15);
        $this->select($order, 'btc')->assertOk();
        $payment = $order->payments()->first();
        $this->ww->tx(703, 'BTC', '0.0001875', $payment->address, $payment->label, 'pending');

        $this->travel(20)->minutes();
        $this->ipn(['id' => 703])->assertOk(); // seen while the lock runs

        $this->travel(2)->hours();
        $this->ww->rates[0]['rate'] = 50000;
        Cache::flush();
        $this->ww->transactions['703']['status'] = 'completed';
        $this->ipn(['id' => 703])->assertOk();

        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
    }

    public function test_payment_for_an_order_that_was_already_paid_is_flagged(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15');
        app(\App\Services\Banners\BannerOrderService::class)->markPaid($order, 'manual', 'admin:1');

        $this->ipn(['id' => 501])->assertOk();

        $payment->refresh();
        $this->assertSame(BannerPaymentStatus::Paid, $payment->status);
        $this->assertTrue($payment->meta['order_already_paid']);
        $this->assertSame('manual', $order->fresh()->payment_provider);
        Queue::assertPushed(RenderBannerOrder::class, 1);
    }

    // ─── scheduled sync ────────────────────────────────────────

    public function test_sync_catches_a_payment_whose_ipn_never_arrived(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15');
        $this->ww->byLabel[$payment->label] = $this->ww->transactions['501'];

        $this->artisan('banners:payments-sync')->assertSuccessful();

        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
        $this->assertNotNull($payment->fresh()->last_checked_at);
    }

    public function test_sync_rechecks_pending_transactions_by_id(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15', 501, 'pending');
        $this->ipn(['id' => 501])->assertOk();
        $this->assertSame(BannerPaymentStatus::Confirming, $payment->fresh()->status);

        $this->ww->transactions['501']['status'] = 'completed';
        $this->artisan('banners:payments-sync')->assertSuccessful();

        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
    }

    public function test_sync_respects_the_interval(): void
    {
        $order = $this->order(15);
        $payment = $this->paidTx($order, '15');
        $payment->forceFill(['last_checked_at' => now()])->save();
        $this->ww->byLabel[$payment->label] = $this->ww->transactions['501'];

        $this->artisan('banners:payments-sync')->assertSuccessful();
        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);
    }

    // ─── other paths keep working ──────────────────────────────

    public function test_auto_approve_still_skips_payment(): void
    {
        config(['banners.auto_approve' => true]);
        $this->getJson('/api/v1/banners/payments/availability')->assertJsonPath('auto_approve', true);
    }

    public function test_cleanup_keeps_unpaid_orders_that_received_crypto(): void
    {
        \Illuminate\Support\Facades\Storage::fake('banners');
        $order = $this->order(15);
        $payment = $this->paidTx($order, '5');
        $this->ipn(['id' => 501])->assertOk();
        $untouched = $this->order(15);

        $this->travel(8)->days();
        $this->artisan('banners:cleanup')->assertSuccessful();

        $this->assertNotNull($order->fresh());
        $this->assertNull($untouched->fresh());
    }

    public function test_label_fits_the_gateway_limit(): void
    {
        $order = $this->order();
        $this->assertSame(30, strlen(BannerPaymentService::label($order)));
    }
}
