<?php

namespace App\Jobs;

use App\Enums\BannerOrderStatus;
use App\Models\BannerOrder;
use App\Services\Banners\BannerOrderService;
use App\Services\Banners\BannerRenderer;
use App\Services\Banners\RenderFailed;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Renders one order on the "banners" queue. One worker process => one render at a time.
 * Two attempts; when both fail the order is marked failed with the error text.
 */
class RenderBannerOrder implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;
    public int $timeout;
    public int $backoff = 30;

    public function __construct(public int $orderId)
    {
        $this->tries = (int) config('banners.render.tries', 2);
        $this->timeout = (int) config('banners.render.job_timeout', 600);
        $this->onConnection(config('banners.queue.connection'));
        $this->onQueue(config('banners.queue.name'));
    }

    public function handle(BannerRenderer $renderer, BannerOrderService $orders): void
    {
        $order = BannerOrder::find($this->orderId);
        // Deleted, or changed by someone else meanwhile (e.g. already rendered)
        if (!$order || !in_array($order->status, [BannerOrderStatus::Queued, BannerOrderStatus::Rendering], true)) {
            return;
        }

        $orders->markRendering($order);

        try {
            $result = $renderer->render($order);
        } catch (\Throwable $e) {
            $log = $e instanceof RenderFailed ? $e->log : null;
            if ($this->attempts() < $this->tries) {
                $orders->markRetrying($order, $e->getMessage());
                throw $e; // the queue retries after $backoff
            }
            $orders->markFailed($order, $e->getMessage(), $log);
            Log::error("Banner order {$order->token} render failed: {$e->getMessage()}");
            $this->fail($e);
            return;
        }

        $orders->markReady($order, $result);
        $this->afterReady($order);
    }

    /** Worker-level failure (timeout, crash): make sure the order doesn't stay "rendering". */
    public function failed(\Throwable $e): void
    {
        $order = BannerOrder::find($this->orderId);
        if ($order && $order->status !== BannerOrderStatus::Failed && $order->status !== BannerOrderStatus::Ready) {
            app(BannerOrderService::class)->markFailed($order, $e->getMessage() ?: 'Render failed');
        }
    }

    /** Hook for notifications (the ready email is added with the mail stage). */
    protected function afterReady(BannerOrder $order): void
    {
    }
}
