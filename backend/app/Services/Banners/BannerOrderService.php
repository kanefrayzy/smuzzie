<?php

namespace App\Services\Banners;

use App\Enums\BannerOrderStatus;
use App\Jobs\RenderBannerOrder;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use App\Services\Mail\BannerNotifications;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Every order status change goes through here.
 *
 *   pending_payment --markPaid()--> queued --job--> rendering --> ready | failed
 *                                     ^-- rerender() (admin) from ready / failed
 *
 * markPaid() is the single entry point into the paid state: the admin's "confirm payment"
 * button, BANNERS_AUTO_APPROVE and the crypto payment service (IPN / sync) call it.
 *
 * The order emails hang off these transitions too (App\Services\Mail\BannerNotifications):
 * create -> "order received", markPaid -> "payment received" (+ admin), markReady -> "banner
 * ready", markFailed -> admin. They are sent after the response / transaction and never throw.
 */
class BannerOrderService
{
    public function __construct(
        private BannerParamsValidator $paramsValidator,
        private BannerImageProcessor $imageProcessor,
        private BannerNotifications $notifications,
    ) {
    }

    /**
     * Validate the buyer's input against a snapshot of the template and create the order.
     *
     * @param array<string, UploadedFile> $files images keyed by zone
     * @throws \Illuminate\Validation\ValidationException
     */
    public function create(BannerTemplate $template, ?string $email, mixed $rawParams, array $files, ?string $ip, bool $isTest = false): BannerOrder
    {
        $snapshot = BannerSnapshot::fromTemplate($template);
        $params = $this->paramsValidator->validate($snapshot['config'], $rawParams);
        $token = (string) Str::uuid();

        // Image zones of the template plus image layers the buyer added
        $imageZones = $snapshot['config']['zones'];
        $layerRects = [];
        foreach ($params['layers'] ?? [] as $layer) {
            $layerRects[$layer['id']] = $layer['rect'];
        }
        foreach (BannerCustomLayers::zones($snapshot['config'], $params) as $zone) {
            $imageZones[] = $zone;
        }

        $images = [];
        try {
            foreach ($imageZones as $zone) {
                $key = $zone['key'];
                $file = $files[$key] ?? null;
                if ($zone['type'] !== 'image' || !($zone['controls']['upload']['enabled'] ?? false) || !$file instanceof UploadedFile) {
                    continue; // files for unknown zones or zones without uploads are ignored
                }
                // Sized for where the buyer put it (a moved or resized zone, or a layer)
                $rect = $layerRects[$key] ?? $params['zones'][$key]['rect'] ?? null;
                $stored = $this->imageProcessor->process(
                    $file,
                    $rect ? array_merge($zone, ['w' => $rect['w'], 'h' => $rect['h']]) : $zone,
                    [$snapshot['media']['width'], $snapshot['media']['height']],
                    "orders/{$token}/image-{$key}", // .png, or .gif when animated
                    "images.{$key}"
                );
                $images[$key] = $stored['path'];
            }
        } catch (\Throwable $e) {
            Storage::disk(config('banners.disks.private'))->deleteDirectory("orders/{$token}");
            throw $e;
        }

        // An image layer without an image draws nothing: don't keep it
        if (isset($params['layers'])) {
            $params['layers'] = array_values(array_filter(
                $params['layers'],
                fn ($layer) => $layer['type'] === 'text' || isset($images[$layer['id']])
            ));
            if (!$params['layers']) {
                unset($params['layers']);
            }
        }

        $order = new BannerOrder([
            'template_id' => $template->id,
            'is_test' => $isTest,
            'email' => $email,
            'status' => BannerOrderStatus::PendingPayment,
            'params' => $params,
            'snapshot' => $snapshot,
            'images' => $images,
            'amount' => $isTest ? 0 : $template->price,
            'currency' => $template->currency,
            'ip' => $ip,
        ]);
        $order->token = $token;
        $order->save();

        if ($isTest) {
            $this->markPaid($order, 'test');
        } elseif (config('banners.auto_approve')) {
            $this->markPaid($order, 'auto');
        } else {
            $this->notifications->orderReceived($order);
        }

        return $order->fresh();
    }

    /**
     * Move a pending order into the render queue. Idempotent: returns false (and changes
     * nothing) when the order is no longer waiting for payment, so a repeated webhook or a
     * double click is harmless.
     */
    public function markPaid(BannerOrder $order, string $provider, ?string $reference = null): bool
    {
        $paid = DB::transaction(function () use ($order, $provider, $reference) {
            $locked = BannerOrder::whereKey($order->id)->lockForUpdate()->first();
            if (!$locked || $locked->status !== BannerOrderStatus::PendingPayment) {
                return false;
            }
            $locked->update([
                'paid_at' => now(),
                'payment_provider' => $provider,
                'payment_reference' => $reference,
            ]);
            $this->enqueue($locked);
            return true;
        });

        $order->refresh();
        if ($paid) {
            $this->notifications->orderPaid($order);
        }

        return $paid;
    }

    /** Admin "re-render": build the files again from the stored params and snapshot. */
    public function rerender(BannerOrder $order): bool
    {
        return DB::transaction(function () use ($order) {
            $locked = BannerOrder::whereKey($order->id)->lockForUpdate()->first();
            if (!$locked || !$locked->status->canRerender()) {
                return false;
            }
            $this->enqueue($locked);
            $order->refresh();
            return true;
        });
    }

    public function markRendering(BannerOrder $order): void
    {
        $order->update([
            'status' => BannerOrderStatus::Rendering,
            'rendering_started_at' => now(),
            'attempts' => $order->attempts + 1,
        ]);
    }

    /** Back in the queue for another attempt after a failed one. */
    public function markRetrying(BannerOrder $order, string $error): void
    {
        $order->update(['status' => BannerOrderStatus::Queued, 'error' => mb_substr($error, 0, 2000)]);
    }

    public function markReady(BannerOrder $order, array $result): void
    {
        $order->update([
            'status' => BannerOrderStatus::Ready,
            'ready_at' => now(),
            'failed_at' => null,
            'result' => $result,
            'result_purged_at' => null,
            'error' => null,
        ]);
        $this->notifications->orderReady($order);
    }

    public function markFailed(BannerOrder $order, string $error, ?string $log = null): void
    {
        $order->update([
            'status' => BannerOrderStatus::Failed,
            'failed_at' => now(),
            'error' => mb_substr($error, 0, 2000),
            'render_log' => $log !== null ? mb_substr($log, -20000) : $order->render_log,
        ]);
        $this->notifications->renderFailed($order);
    }

    private function enqueue(BannerOrder $order): void
    {
        $order->update([
            'status' => BannerOrderStatus::Queued,
            'queued_at' => now(),
            'rendering_started_at' => null,
            'error' => null,
        ]);
        // The "banners" connection dispatches after the surrounding transaction commits
        RenderBannerOrder::dispatch($order->id);
    }
}
