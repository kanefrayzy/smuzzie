<?php

namespace Tests\Feature\Mail;

use App\Enums\BannerOrderStatus;
use App\Mail\AdminOrderPaidMail;
use App\Mail\AdminPaymentReviewMail;
use App\Mail\BannerPaymentConfirmedMail;
use App\Models\BannerOrder;
use App\Models\BannerPayment;
use App\Services\Banners\BannerOrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\Feature\Banners\Payments\FakeWestWallet;
use Tests\TestCase;

/** Emails driven by crypto payment notifications: paid once per order, review once per reason. */
class PaymentMailTest extends TestCase
{
    use RefreshDatabase;

    private const IPN_IP = '45.155.121.88';

    private FakeWestWallet $ww;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Mail::fake();
        Cache::flush();
        config([
            'app.url' => 'https://shop.test',
            'banners.frontend_url' => 'https://smuzzie.com',
            'mail.admin_address' => 'owner@example.com',
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
        return BannerOrder::factory()->create(['amount' => $amount, 'email' => 'buyer@example.com']);
    }

    private function ipn(int $id)
    {
        return $this->withServerVariables(['REMOTE_ADDR' => self::IPN_IP])->post('/api/v1/payments/westwallet/ipn', ['id' => $id]);
    }

    private function usdtPayment(BannerOrder $order): BannerPayment
    {
        $this->postJson("/api/v1/banners/orders/{$order->token}/payment", ['method' => 'usdt-trc20'])->assertOk();
        return $order->payments()->first();
    }

    public function test_duplicate_ipns_send_the_paid_emails_once(): void
    {
        $order = $this->order(15);
        $payment = $this->usdtPayment($order);
        $this->ww->tx(501, 'USDTTRC', '15', $payment->address, $payment->label);

        $this->ipn(501)->assertOk();
        $this->ipn(501)->assertOk();
        $this->ipn(501)->assertOk();

        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
        Mail::assertSent(BannerPaymentConfirmedMail::class, 1);
        Mail::assertSent(BannerPaymentConfirmedMail::class, fn ($m) => $m->hasTo('buyer@example.com')
            && str_contains($m->render(), '15 USDT') && str_contains($m->render(), 'hash501'));
        Mail::assertSent(AdminOrderPaidMail::class, 1);
        Mail::assertNotSent(AdminPaymentReviewMail::class);
    }

    public function test_underpayment_notifies_the_admin_once_then_the_rest_completes_the_order(): void
    {
        $order = $this->order(15);
        $payment = $this->usdtPayment($order);
        $this->ww->tx(501, 'USDTTRC', '10', $payment->address, $payment->label);

        $this->ipn(501)->assertOk();
        $this->ipn(501)->assertOk(); // repeated notification

        Mail::assertSent(AdminPaymentReviewMail::class, 1);
        Mail::assertSent(AdminPaymentReviewMail::class, function (AdminPaymentReviewMail $m) {
            $html = $m->render();
            return $m->hasTo('owner@example.com') && $m->reasonKey === 'underpaid'
                && str_contains($html, '10 USDT') && str_contains($html, '15 USDT');
        });
        Mail::assertNotSent(BannerPaymentConfirmedMail::class);

        // A second partial payment that is still short: no second email
        $this->ww->tx(502, 'USDTTRC', '2', $payment->address, $payment->label);
        $this->ipn(502)->assertOk();
        Mail::assertSent(AdminPaymentReviewMail::class, 1);

        $this->ww->tx(503, 'USDTTRC', '3', $payment->address, $payment->label);
        $this->ipn(503)->assertOk();
        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);
        Mail::assertSent(BannerPaymentConfirmedMail::class, 1);
        Mail::assertSent(AdminOrderPaidMail::class, 1);
    }

    public function test_late_payment_that_falls_short_asks_the_admin_to_review(): void
    {
        $order = $this->order(15);
        $this->postJson("/api/v1/banners/orders/{$order->token}/payment", ['method' => 'btc'])->assertOk();
        $payment = $order->payments()->first();
        $this->ww->tx(701, 'BTC', '0.0001875', $payment->address, $payment->label);

        $this->travel(50)->minutes();
        $this->ww->rates[0]['rate'] = 70000;
        Cache::flush();
        $this->ipn(701)->assertOk();
        $this->ipn(701)->assertOk();

        Mail::assertSent(AdminPaymentReviewMail::class, 1);
        Mail::assertSent(AdminPaymentReviewMail::class, fn ($m) => $m->reasonKey === 'late_short'
            && str_contains($m->render(), 'no longer covers the price')
            && str_contains($m->render(), '$13.13'));
        Mail::assertNotSent(BannerPaymentConfirmedMail::class);
    }

    public function test_second_payment_for_a_paid_order_is_flagged_to_the_admin(): void
    {
        $order = $this->order(15);
        $payment = $this->usdtPayment($order);
        $this->ww->tx(501, 'USDTTRC', '15', $payment->address, $payment->label);
        app(BannerOrderService::class)->markPaid($order, 'manual', 'admin:1');

        $this->ipn(501)->assertOk();
        $this->ipn(501)->assertOk();

        Mail::assertSent(AdminPaymentReviewMail::class, 1);
        Mail::assertSent(AdminPaymentReviewMail::class, fn ($m) => $m->reasonKey === 'already_paid'
            && str_contains($m->render(), 'paid twice'));
        Mail::assertSent(BannerPaymentConfirmedMail::class, 1); // from the manual confirmation only
        Mail::assertNotSent(AdminOrderPaidMail::class);
    }

    public function test_review_emails_are_skipped_without_an_admin_address(): void
    {
        config(['mail.admin_address' => '']);
        $order = $this->order(15);
        $payment = $this->usdtPayment($order);
        $this->ww->tx(501, 'USDTTRC', '10', $payment->address, $payment->label);

        $this->ipn(501)->assertOk();

        Mail::assertNothingSent();
        $this->assertSame('underpaid', $payment->fresh()->status->value);
    }
}
