<?php

namespace App\Services\Payments;

use App\Enums\BannerPaymentStatus;
use App\Models\BannerPayment;
use App\Models\BannerPaymentTransaction;

/** JSON shapes of a payment for the buyer's order page and for the admin. */
class BannerPaymentPresenter
{
    public static function public(BannerPayment $payment): array
    {
        $display = $payment->meta['display'] ?? [];
        $decimals = (int) ($display['decimals'] ?? 8);
        $txs = $payment->relationLoaded('transactions') ? $payment->transactions : $payment->transactions()->get();
        $pendingTxs = $txs->where('status', BannerPaymentTransaction::PENDING);
        $amount = (float) $payment->amount;
        $received = (float) $payment->received;

        return [
            'method' => $payment->method,
            'coin' => $payment->coin,
            'coin_name' => $display['coin_name'] ?? $payment->coin,
            'network' => $payment->network,
            'network_name' => $display['network_name'] ?? $payment->network,
            'icon' => $display['icon'] ?? strtolower($payment->coin),
            'network_icon' => $display['network_icon'] ?? null,
            'address' => $payment->address,
            'dest_tag' => $payment->dest_tag,
            'amount' => Amount::format($amount, $decimals),
            'amount_usd' => (string) $payment->amount_usd,
            'received' => Amount::format($received, $decimals),
            'pending' => Amount::format((float) $pendingTxs->sum(fn ($t) => (float) $t->amount), $decimals),
            'remaining' => Amount::format(Amount::ceil(max(0, $amount - $received), $decimals), $decimals),
            'confirmations' => (int) $pendingTxs->max('confirmations'),
            'status' => $payment->status->value,
            'expires_at' => $payment->expires_at?->toIso8601String(),
            // The quote can be renewed only while nothing has arrived
            'expired' => $payment->status === BannerPaymentStatus::Awaiting && $payment->isExpired(),
            'paid_at' => $payment->paid_at?->toIso8601String(),
        ];
    }

    public static function admin(BannerPayment $payment): array
    {
        $meta = $payment->meta ?? [];

        return self::public($payment) + [
            'id' => $payment->id,
            'provider' => $payment->provider,
            'currency' => $payment->currency,
            'label' => $payment->label,
            'rate' => (string) $payment->rate,
            'quoted_at' => $payment->quoted_at?->toIso8601String(),
            'selected_at' => $payment->selected_at?->toIso8601String(),
            'detected_at' => $payment->detected_at?->toIso8601String(),
            'last_checked_at' => $payment->last_checked_at?->toIso8601String(),
            'overpaid' => $meta['overpaid'] ?? null,
            'review_reason' => $meta['review_reason'] ?? null,
            'late_value_usd' => $meta['late_value_usd'] ?? null,
            'order_already_paid' => (bool) ($meta['order_already_paid'] ?? false),
            'transactions' => $payment->transactions->map(fn (BannerPaymentTransaction $t) => [
                'provider_id' => $t->provider_id,
                'currency' => $t->currency,
                'amount' => Amount::format((float) $t->amount),
                'status' => $t->status,
                'provider_status' => $t->provider_status,
                'confirmations' => $t->confirmations,
                'hash' => $t->hash,
                'first_seen_at' => $t->first_seen_at?->toIso8601String(),
                'completed_at' => $t->completed_at?->toIso8601String(),
            ])->values()->all(),
        ];
    }
}
