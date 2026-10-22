<?php

namespace Tests\Feature\Mail;

use App\Enums\BannerPaymentStatus;
use App\Jobs\RenderBannerOrder;
use App\Mail\AdminOrderPaidMail;
use App\Mail\AdminRenderFailedMail;
use App\Mail\BannerOrderReceivedMail;
use App\Mail\BannerPaymentConfirmedMail;
use App\Mail\BannerReadyMail;
use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use App\Services\Banners\BannerOrderService;
use App\Services\Banners\BannerRenderer;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Banner order emails: the right moment, once, never for test or auto-approved orders. */
class BannerOrderMailTest extends TestCase
{
    use RefreshDatabase;

    private BannerTemplate $template;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Storage::fake('public');
        Queue::fake();
        Mail::fake();
        config([
            'banners.frontend_url' => 'https://smuzzie.com',
            'mail.admin_address' => 'owner@example.com',
        ]);

        $font = BannerFont::factory()->create();
        Storage::disk('public')->put($font->path, 'wOF2font');
        $this->template = BannerTemplate::factory()->published()->create([
            'slug' => 'neon',
            'name' => 'Neon <Sale> & Co',
            'price' => 15,
            'config' => BannerTemplateFactory::sampleConfig($font->id),
        ]);
        Storage::disk('banners')->put($this->template->source_path, 'MASTER');
    }

    private function postOrder()
    {
        return $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'Buyer@Example.com',
            'params' => json_encode(['schemaVersion' => 1, 'zones' => ['title' => ['text' => 'Nova Pay']]]),
        ], ['Accept' => 'application/json']);
    }

    private function createOrder(bool $isTest = false): BannerOrder
    {
        return app(BannerOrderService::class)->create(
            $this->template,
            $isTest ? null : 'buyer@example.com',
            ['schemaVersion' => 1, 'zones' => ['title' => ['text' => 'Nova Pay']]],
            [],
            '127.0.0.1',
            $isTest
        );
    }

    private function fakeRenderer(bool $ok = true): void
    {
        Process::fake(function (PendingProcess $process) use ($ok) {
            if (!$ok) {
                return Process::result(json_encode(['ok' => false, 'error' => 'Font failed to load: <bf-1>']) . "\n", 'trace', 1);
            }
            $job = json_decode(file_get_contents(end($process->command)), true);
            @mkdir($job['workDir'], 0755, true);
            file_put_contents($job['workDir'] . '/banner.mp4', 'MP4DATA');

            return Process::result(json_encode(['ok' => true, 'mp4' => ['path' => $job['workDir'] . '/banner.mp4', 'size' => 7]]) . "\n");
        });
    }

    private function render(BannerOrder $order): void
    {
        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));
    }

    // ─── order received ────────────────────────────────────────

    public function test_order_received_is_sent_with_the_payment_link_after_the_request(): void
    {
        $this->postOrder()->assertCreated();
        $order = BannerOrder::firstOrFail();

        Mail::assertSent(BannerOrderReceivedMail::class, function (BannerOrderReceivedMail $mail) use ($order) {
            $html = $mail->render();
            return $mail->hasTo('buyer@example.com')
                && str_contains($html, "https://smuzzie.com/banners/order/{$order->token}")
                && str_contains($html, 'Complete payment')
                && str_contains($html, '$15.00')
                && str_contains($html, 'Neon &lt;Sale&gt; &amp; Co')   // template name escaped
                && !str_contains($html, 'Neon <Sale>')
                && str_contains($html, 'locked for <strong class="em-strong" style="color:#16161a;">30 minutes')
                && str_contains($html, 'deleted after 7 days');
        });
        Mail::assertSent(BannerOrderReceivedMail::class, 1);
        Mail::assertNotSent(BannerPaymentConfirmedMail::class);
        $this->assertNotNull($order->received_notified_at);
    }

    public function test_no_mail_for_test_renders_or_auto_approved_orders(): void
    {
        $this->fakeRenderer();
        $test = $this->createOrder(isTest: true);
        $this->render($test);

        config(['banners.auto_approve' => true]);
        $auto = $this->createOrder();
        $this->render($auto);

        $this->assertSame('ready', $test->fresh()->status->value);
        Mail::assertNotSent(BannerOrderReceivedMail::class);
        Mail::assertNotSent(BannerPaymentConfirmedMail::class);
        Mail::assertNotSent(AdminOrderPaidMail::class);
        // The ready email still goes to a real buyer of an auto-approved order
        Mail::assertSent(BannerReadyMail::class, 1);
        Mail::assertSent(BannerReadyMail::class, fn ($m) => $m->hasTo('buyer@example.com'));
    }

    public function test_test_render_failure_does_not_notify_the_admin(): void
    {
        config(['banners.render.tries' => 1]);
        $this->fakeRenderer(ok: false);
        $this->render($this->createOrder(isTest: true));

        Mail::assertNothingSent();
    }

    // ─── payment confirmed ─────────────────────────────────────

    public function test_crypto_payment_emails_buyer_and_admin_once_with_the_transaction(): void
    {
        $order = $this->createOrder();
        $payment = $order->payments()->create([
            'provider' => 'westwallet', 'method' => 'usdt-trc20', 'currency' => 'USDTTRC', 'coin' => 'USDT', 'network' => 'TRC20',
            'address' => 'TTestAddress', 'label' => 'lbl', 'status' => BannerPaymentStatus::Paid, 'paid_at' => now(),
            'amount_usd' => 15, 'rate' => 1, 'amount' => 15, 'received' => 20,
            'meta' => ['display' => ['network_name' => 'Tron (TRC20)', 'decimals' => 2], 'overpaid' => '5'],
        ]);
        $payment->transactions()->create(['provider' => 'westwallet', 'provider_id' => '501', 'currency' => 'USDTTRC', 'amount' => 20, 'status' => 'completed', 'hash' => 'deadbeef501', 'first_seen_at' => now()]);

        $service = app(BannerOrderService::class);
        $this->assertTrue($service->markPaid($order, 'westwallet', '501'));
        $this->assertFalse($service->markPaid($order->fresh(), 'westwallet', '501')); // repeated IPN

        Mail::assertSent(BannerPaymentConfirmedMail::class, 1);
        Mail::assertSent(BannerPaymentConfirmedMail::class, function (BannerPaymentConfirmedMail $mail) use ($order) {
            $html = $mail->render();
            return $mail->hasTo('buyer@example.com')
                && str_contains($html, 'Payment received')
                && str_contains($html, '20 USDT')
                && str_contains($html, 'Tron (TRC20)')
                && str_contains($html, 'deadbeef501')
                && str_contains($html, "/banners/order/{$order->token}");
        });
        Mail::assertSent(AdminOrderPaidMail::class, 1);
        Mail::assertSent(AdminOrderPaidMail::class, function (AdminOrderPaidMail $mail) use ($order) {
            $html = $mail->render();
            return $mail->hasTo('owner@example.com')
                && str_contains($html, 'https://smuzzie.com/admin/banners/orders')
                && str_contains($html, substr($order->token, 0, 8))
                && str_contains($html, 'WestWallet')
                && str_contains($html, '5 USDT') // overpaid
                && str_contains($html, 'buyer@example.com');
        });
        $order->refresh();
        $this->assertNotNull($order->paid_notified_at);
        $this->assertNotNull($order->admin_paid_notified_at);
    }

    public function test_manual_confirmation_emails_the_buyer_but_not_the_admin(): void
    {
        $order = $this->createOrder();
        app(BannerOrderService::class)->markPaid($order, 'manual', 'admin:1');

        Mail::assertSent(BannerPaymentConfirmedMail::class, fn ($m) => $m->hasTo('buyer@example.com') && !str_contains($m->render(), 'Transaction'));
        Mail::assertNotSent(AdminOrderPaidMail::class);
    }

    public function test_admin_mails_are_skipped_without_an_admin_address(): void
    {
        config(['mail.admin_address' => null, 'banners.render.tries' => 1]);
        $order = $this->createOrder();
        app(BannerOrderService::class)->markPaid($order, 'westwallet', '1');
        $this->fakeRenderer(ok: false);
        $this->render($order);

        Mail::assertSent(BannerPaymentConfirmedMail::class, 1);
        Mail::assertNotSent(AdminOrderPaidMail::class);
        Mail::assertNotSent(AdminRenderFailedMail::class);
        $this->assertNull($order->fresh()->admin_paid_notified_at);
    }

    public function test_several_admin_addresses_are_accepted(): void
    {
        config(['mail.admin_address' => 'a@example.com, b@example.com, not-an-email']);
        app(BannerOrderService::class)->markPaid($this->createOrder(), 'westwallet', '1');

        Mail::assertSent(AdminOrderPaidMail::class, fn ($m) => $m->hasTo('a@example.com') && $m->hasTo('b@example.com') && !$m->hasTo('not-an-email'));
    }

    // ─── render failed / ready ─────────────────────────────────

    public function test_render_failure_notifies_the_admin_after_the_last_attempt_only_once(): void
    {
        $order = $this->createOrder();
        app(BannerOrderService::class)->markPaid($order, 'manual');
        $this->fakeRenderer(ok: false);

        try {
            $this->render($order); // first of two attempts: back to the queue, no email
        } catch (\RuntimeException) {
        }
        Mail::assertNotSent(AdminRenderFailedMail::class);

        config(['banners.render.tries' => 1]);
        $this->render($order);
        Mail::assertSent(AdminRenderFailedMail::class, function (AdminRenderFailedMail $mail) {
            $html = $mail->render();
            return $mail->hasTo('owner@example.com')
                && str_contains($html, 'Font failed to load: &lt;bf-1&gt;')
                && !str_contains($html, '<bf-1>');
        });

        // The admin renders it again and it fails again: no second email
        app(BannerOrderService::class)->rerender($order->fresh());
        $this->render($order);
        Mail::assertSent(AdminRenderFailedMail::class, 1);
        Mail::assertNotSent(BannerReadyMail::class);
    }

    public function test_full_flow_sends_each_buyer_email_once(): void
    {
        $this->postOrder()->assertCreated();
        $order = BannerOrder::firstOrFail();
        app(BannerOrderService::class)->markPaid($order, 'westwallet', '9');
        $this->fakeRenderer();
        $this->render($order);
        app(BannerOrderService::class)->rerender($order->fresh());
        $this->render($order);

        Mail::assertSent(BannerOrderReceivedMail::class, 1);
        Mail::assertSent(BannerPaymentConfirmedMail::class, 1);
        Mail::assertSent(BannerReadyMail::class, 1);
        Mail::assertSent(AdminOrderPaidMail::class, 1);
        Mail::assertNotSent(AdminRenderFailedMail::class);
    }

    // ─── failures and transactions ─────────────────────────────

    public function test_broken_mail_never_fails_the_order_request_and_releases_the_claim(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('Connection could not be established with host smtp.resend.com'));

        $this->postOrder()->assertCreated();

        $order = BannerOrder::firstOrFail();
        $this->assertSame('pending_payment', $order->status->value);
        $this->assertNull($order->received_notified_at); // free for a later attempt
    }

    public function test_nothing_is_mailed_for_a_rolled_back_transaction(): void
    {
        $order = $this->createOrder();

        try {
            DB::transaction(function () use ($order) {
                app(BannerOrderService::class)->markPaid($order, 'westwallet', '1');
                throw new \RuntimeException('rollback');
            });
        } catch (\RuntimeException) {
        }

        Mail::assertNotSent(BannerPaymentConfirmedMail::class);
        Mail::assertNotSent(AdminOrderPaidMail::class);
        $this->assertSame('pending_payment', $order->fresh()->status->value);
    }
}
