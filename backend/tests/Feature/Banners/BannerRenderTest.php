<?php

namespace Tests\Feature\Banners;

use App\Enums\BannerOrderStatus;
use App\Jobs\RenderBannerOrder;
use App\Mail\BannerReadyMail;
use Illuminate\Support\Facades\Mail;
use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use App\Models\User;
use App\Services\Banners\BannerOrderService;
use App\Services\Banners\BannerRenderer;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

/** Laravel side of rendering: job.json contents, result handling, failures, test renders. */
class BannerRenderTest extends TestCase
{
    use RefreshDatabase;

    private BannerTemplate $template;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Storage::fake('public');
        Queue::fake();

        $font = BannerFont::factory()->create();
        Storage::disk('public')->put($font->path, 'wOF2font');
        $config = BannerTemplateFactory::sampleConfig($font->id);
        $this->template = BannerTemplate::factory()->published()->create([
            'config' => $config,
            'outputs' => ['mp4' => true, 'gif' => ['enabled' => true, 'width' => 600, 'fps' => 15]],
        ]);
        Storage::disk('banners')->put($this->template->source_path, 'MASTER');
    }

    private function paidOrder(): BannerOrder
    {
        $order = app(BannerOrderService::class)->create(
            $this->template,
            'buyer@example.com',
            ['schemaVersion' => 1, 'hue' => 150, 'zones' => ['title' => ['text' => 'Nova Pay']]],
            ['logo' => UploadedFile::fake()->image('logo.png', 200, 50)],
            '127.0.0.1'
        );
        app(BannerOrderService::class)->markPaid($order, 'manual');

        return $order->fresh();
    }

    /** A fake renderer that behaves like render.mjs: reads job.json, writes the files, prints JSON. */
    private function fakeRenderer(?array &$seenJob = null): void
    {
        Process::fake(function (PendingProcess $process) use (&$seenJob) {
            $job = json_decode(file_get_contents(end($process->command)), true);
            $seenJob = $job;
            @mkdir($job['workDir'], 0755, true);
            file_put_contents($job['workDir'] . '/banner.mp4', 'MP4DATA');
            file_put_contents($job['workDir'] . '/banner.gif', 'GIFDATA');

            return Process::result(json_encode([
                'ok' => true,
                'mp4' => ['path' => $job['workDir'] . '/banner.mp4', 'size' => 7],
                'gif' => ['path' => $job['workDir'] . '/banner.gif', 'size' => 7],
                'hue' => 150,
                'timings' => ['overlay_ms' => 600, 'mp4_ms' => 2700],
                'fit' => ['title' => ['shrunk' => false]],
            ]) . "\n");
        });
    }

    public function test_successful_render_stores_files_and_marks_ready(): void
    {
        $order = $this->paidOrder();
        $this->fakeRenderer($job);

        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));
        $order->refresh();

        $this->assertSame(BannerOrderStatus::Ready, $order->status);
        $this->assertSame("orders/{$order->token}/banner.mp4", $order->result['mp4']['path']);
        Storage::disk('banners')->assertExists(["orders/{$order->token}/banner.mp4", "orders/{$order->token}/banner.gif"]);
        $this->assertSame('MP4DATA', Storage::disk('banners')->get($order->result['mp4']['path']));
        $this->assertSame(['overlay_ms' => 600, 'mp4_ms' => 2700], $order->result['timings']);
        $this->assertSame([], Storage::disk('banners')->directories('tmp')); // temp folder cleaned up

        // job.json is built from the snapshot only: master, font files, logo, normalized params
        $this->assertSame([1450, 1694], [$job['width'], $job['height']]);
        $this->assertSame(Storage::disk('banners')->path($this->template->source_path), $job['source']);
        $this->assertSame(Storage::disk('public')->path($order->snapshot['fonts'][0]['path']), $job['fonts'][0]['file']);
        $this->assertSame(Storage::disk('banners')->path($order->images['logo']), $job['images']['logo']);
        $this->assertSame($order->params, $job['params']);
        $this->assertTrue($job['sandbox']);
        $this->assertTrue($job['outputs']['gif']['enabled']);

        Process::assertRan(fn (PendingProcess $p) => str_ends_with($p->command[1], 'render.mjs') && $p->timeout === 540);
    }

    public function test_ready_email_is_sent_once_with_the_order_link(): void
    {
        Mail::fake();
        config(['banners.frontend_url' => 'https://smuzzie.com']);
        $order = $this->paidOrder();
        $this->fakeRenderer();

        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));

        Mail::assertSent(BannerReadyMail::class, function (BannerReadyMail $mail) use ($order) {
            $html = $mail->render();
            return $mail->hasTo('buyer@example.com')
                && str_contains($html, "https://smuzzie.com/banners/order/{$order->token}")
                && !str_contains($html, 'signature='); // no expiring links in the email
        });
        $this->assertNotNull($order->fresh()->notified_at);

        // Rendering again doesn't email again
        app(BannerOrderService::class)->rerender($order->fresh());
        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));
        Mail::assertSent(BannerReadyMail::class, 1);
    }

    public function test_broken_mail_does_not_fail_the_order(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP connection refused'));
        $order = $this->paidOrder();
        $this->fakeRenderer();

        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));

        $order->refresh();
        $this->assertSame(BannerOrderStatus::Ready, $order->status);
        $this->assertNull($order->notified_at);
    }

    public function test_test_renders_are_never_emailed(): void
    {
        Mail::fake();
        $order = app(BannerOrderService::class)->create($this->template, null, ['zones' => []], [], null, true);
        $this->fakeRenderer();

        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));

        $this->assertSame(BannerOrderStatus::Ready, $order->fresh()->status);
        Mail::assertNothingSent();
    }

    public function test_renderer_error_is_retried_then_marks_failed_with_log(): void
    {
        $order = $this->paidOrder();
        Process::fake(fn () => Process::result(
            json_encode(['ok' => false, 'error' => 'Font failed to load: bf-1']) . "\n",
            'Error: Font failed to load at render.html',
            1
        ));

        // First attempt: back to the queue
        try {
            (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));
            $this->fail('The first attempt should throw so the queue retries it');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('Font failed to load', $e->getMessage());
        }
        $this->assertSame(BannerOrderStatus::Queued, $order->fresh()->status);

        // Last attempt: failed, with the renderer's output kept for the admin
        config(['banners.render.tries' => 1]);
        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));
        $order->refresh();

        $this->assertSame(BannerOrderStatus::Failed, $order->status);
        $this->assertSame('Render failed: Font failed to load: bf-1', $order->error);
        $this->assertStringContainsString('render.html', $order->render_log);
        $this->assertSame(2, $order->attempts);
        $this->assertNotNull($order->failed_at);
    }

    public function test_missing_master_fails_without_running_node(): void
    {
        $order = $this->paidOrder();
        Storage::disk('banners')->delete($this->template->source_path);
        Process::fake();
        config(['banners.render.tries' => 1]);

        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));

        $this->assertSame(BannerOrderStatus::Failed, $order->fresh()->status);
        Process::assertNothingRan();
    }

    public function test_job_ignores_orders_that_are_not_queued(): void
    {
        $order = BannerOrder::factory()->create(); // pending payment
        Process::fake();

        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));

        $this->assertSame(BannerOrderStatus::PendingPayment, $order->fresh()->status);
        Process::assertNothingRan();
    }

    public function test_admin_test_render_creates_hidden_queued_order_with_sample_logo(): void
    {
        $token = JWTAuth::fromUser(User::factory()->admin()->create());

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/v1/admin/banner-templates/{$this->template->id}/test-render")
            ->assertCreated()
            ->assertJsonPath('is_test', true)
            ->assertJsonPath('status', 'queued')
            ->assertJsonPath('email', null);

        $order = BannerOrder::findOrFail($response->json('id'));
        $this->assertSame('test', $order->payment_provider);
        $this->assertSame('0.00', $order->amount);
        Storage::disk('banners')->assertExists($order->images['logo']);
        Queue::assertPushed(RenderBannerOrder::class);

        $this->getJson('/api/v1/admin/banner-orders')->assertJsonPath('orders.total', 0); // hidden from the list
        $this->getJson("/api/v1/admin/banner-templates/{$this->template->id}/test-render")->assertJsonPath('id', $order->id);
    }
}
