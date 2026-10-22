<?php

namespace App\Services\Banners;

use App\Enums\BannerOrderStatus;
use App\Models\BannerOrder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/** JSON shapes of an order for the buyer's status page and for the admin. */
class BannerOrderPresenter
{
    /** What the buyer sees on /banners/order/<token>: no internals, no error details. */
    public static function public(BannerOrder $order): array
    {
        $snapshot = $order->snapshot ?? [];
        $ready = $order->status === BannerOrderStatus::Ready;
        $days = (int) config('banners.retention.result_days', 30);

        return [
            'token' => $order->token,
            'status' => $order->status->value,
            'template' => [
                'name' => $snapshot['template']['name'] ?? null,
                'slug' => $snapshot['template']['slug'] ?? null,
            ],
            'formats' => self::formats($snapshot),
            'email' => self::maskEmail($order->email),
            'created_at' => $order->created_at?->toIso8601String(),
            'paid_at' => $order->paid_at?->toIso8601String(),
            'ready_at' => $order->ready_at?->toIso8601String(),
            'files_expire_at' => $ready && $order->ready_at ? $order->ready_at->copy()->addDays($days)->toIso8601String() : null,
            'files_expired' => $ready && $order->result_purged_at !== null,
            'downloads' => self::downloads($order),
        ];
    }

    public static function admin(BannerOrder $order, bool $full = false): array
    {
        $snapshot = $order->snapshot ?? [];
        $data = [
            'id' => $order->id,
            'token' => $order->token,
            'status' => $order->status->value,
            'is_test' => $order->is_test,
            'email' => $order->email,
            'template' => [
                'id' => $order->template_id,
                'name' => $snapshot['template']['name'] ?? $order->template?->name,
                'slug' => $snapshot['template']['slug'] ?? null,
            ],
            'amount' => $order->amount,
            'currency' => $order->currency,
            'payment_provider' => $order->payment_provider,
            'attempts' => $order->attempts,
            'error' => $order->error,
            'created_at' => $order->created_at?->toIso8601String(),
            'paid_at' => $order->paid_at?->toIso8601String(),
            'queued_at' => $order->queued_at?->toIso8601String(),
            'rendering_started_at' => $order->rendering_started_at?->toIso8601String(),
            'ready_at' => $order->ready_at?->toIso8601String(),
            'failed_at' => $order->failed_at?->toIso8601String(),
            'notified_at' => $order->notified_at?->toIso8601String(),
            'result_purged_at' => $order->result_purged_at?->toIso8601String(),
        ];

        if ($full) {
            $data += [
                'params' => $order->params,
                'snapshot' => [
                    'snapshotVersion' => $snapshot['snapshotVersion'] ?? null,
                    'template' => $snapshot['template'] ?? null,
                    'config' => $snapshot['config'] ?? null,
                    'outputs' => $snapshot['outputs'] ?? null,
                    'media' => array_diff_key($snapshot['media'] ?? [], ['source_path' => true]),
                    'fonts' => array_map(fn ($f) => array_diff_key($f, ['path' => true]) + [
                        'url' => Storage::disk(config('banners.disks.public'))->url($f['path']),
                    ], $snapshot['fonts'] ?? []),
                ],
                // For the admin's live preview of the order (the template's current preview video)
                'preview_url' => $order->template?->preview_url,
                'images' => collect($order->images ?? [])->map(fn ($path, $key) => URL::temporarySignedRoute(
                    'banners.image',
                    now()->addHour(),
                    ['token' => $order->token, 'key' => $key]
                ))->all(),
                'result' => $order->result ? [
                    'timings' => $order->result['timings'] ?? null,
                    'fit' => $order->result['fit'] ?? null,
                    'mp4_size' => $order->result['mp4']['size'] ?? null,
                    'gif_size' => $order->result['gif']['size'] ?? null,
                ] : null,
                'render_log' => $order->render_log,
                'downloads' => self::downloads($order),
                'ip' => $order->ip,
            ];
        }

        return $data;
    }

    /** @return array<string, string>|null fresh signed URLs, valid for the configured days */
    private static function downloads(BannerOrder $order): ?array
    {
        $formats = $order->resultFormats();
        if (!$formats) {
            return null;
        }
        $expires = now()->addDays((int) config('banners.download_link_days', 7));
        $links = [];
        foreach ($formats as $format) {
            $links[$format] = URL::temporarySignedRoute('banners.download', $expires, ['token' => $order->token, 'format' => $format]);
        }
        return $links;
    }

    private static function formats(array $snapshot): array
    {
        $formats = ['mp4'];
        if ($snapshot['outputs']['gif']['enabled'] ?? false) {
            $formats[] = 'gif';
        }
        return $formats;
    }

    private static function maskEmail(?string $email): ?string
    {
        if (!$email || !str_contains($email, '@')) {
            return null;
        }
        [$user, $domain] = explode('@', $email, 2);
        return mb_substr($user, 0, 1) . str_repeat('•', max(1, min(6, mb_strlen($user) - 1))) . '@' . $domain;
    }
}
