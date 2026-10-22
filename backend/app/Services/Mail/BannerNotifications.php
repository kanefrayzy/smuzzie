<?php

namespace App\Services\Mail;

use App\Mail\AdminOrderPaidMail;
use App\Mail\AdminPaymentReviewMail;
use App\Mail\AdminRenderFailedMail;
use App\Mail\BannerOrderReceivedMail;
use App\Mail\BannerPaymentConfirmedMail;
use App\Mail\BannerReadyMail;
use App\Models\BannerOrder;
use App\Models\BannerPayment;
use App\Models\BannerPaymentTransaction;
use App\Services\Payments\Amount;
use Illuminate\Mail\Mailable;

/**
 * Banner order emails: who gets what, and when.
 *
 *   buyer  received   BannerOrderService::create()     real order waiting for payment
 *   buyer  paid       BannerOrderService::markPaid()   paid by the buyer or confirmed by the admin
 *   admin  paid       BannerOrderService::markPaid()   paid by the buyer (not the admin's own button)
 *   buyer  ready      RenderBannerOrder                render done
 *   admin  failed     BannerOrderService::markFailed() last attempt failed
 *   admin  review     BannerPaymentService             underpaid, late, or paid twice
 *
 * Never for test renders, nor for BANNERS_AUTO_APPROVE (no money moved). Each order email is
 * sent at most once: its *_notified_at column is claimed atomically right before sending
 * (released again when sending fails), so repeated IPNs, re-renders and job retries can't
 * send a second copy. Review emails are guarded per payment and reason in the payment's meta,
 * under the payment's row lock (BannerPaymentService).
 */
class BannerNotifications
{
    /** Providers whose "paid" isn't a payment: admin test renders and BANNERS_AUTO_APPROVE. */
    private const NOT_A_PAYMENT = ['test', 'auto'];

    public const REVIEW_REASONS = ['underpaid', 'late', 'late_short', 'already_paid'];

    public function __construct(private MailSender $mail)
    {
    }

    public function orderReceived(BannerOrder $order): void
    {
        if ($order->is_test || !$order->email || $order->status?->isPaid()) {
            return;
        }
        $this->once($order, 'received_notified_at', $order->email, new BannerOrderReceivedMail($order));
    }

    public function orderPaid(BannerOrder $order): void
    {
        if ($order->is_test || in_array($order->payment_provider, self::NOT_A_PAYMENT, true)) {
            return;
        }
        $payment = $order->payments()->where('status', 'paid')->orderByDesc('paid_at')->orderByDesc('id')->first();
        $details = $payment ? self::paymentDetails($payment) : null;

        if ($order->email) {
            $this->once($order, 'paid_notified_at', $order->email, new BannerPaymentConfirmedMail($order, $details));
        }
        // The admin's own "Confirm payment" click needs no email to the admin
        if ($order->payment_provider !== 'manual') {
            $this->once($order, 'admin_paid_notified_at', MailSender::adminRecipients(), new AdminOrderPaidMail($order, $details));
        }
    }

    public function orderReady(BannerOrder $order): void
    {
        if ($order->is_test || !$order->email) {
            return;
        }
        $this->once($order, 'notified_at', $order->email, new BannerReadyMail($order));
    }

    public function renderFailed(BannerOrder $order): void
    {
        if ($order->is_test) {
            return;
        }
        $this->once($order, 'admin_failed_notified_at', MailSender::adminRecipients(), new AdminRenderFailedMail($order));
    }

    /** Called by BannerPaymentService once per payment and reason (it keeps that guard). */
    public function paymentNeedsReview(BannerPayment $payment, string $reason): void
    {
        $order = $payment->order()->first();
        if (!$order || $order->is_test) {
            return;
        }
        $this->mail->send(MailSender::adminRecipients(), new AdminPaymentReviewMail($order, $reason, self::paymentDetails($payment)));
    }

    /**
     * What the emails show about a crypto payment.
     *
     * @return array{expected: string, received: string, network: string, tx: ?string, overpaid: ?string, late_value_usd: mixed}
     */
    public static function paymentDetails(BannerPayment $payment): array
    {
        $meta = $payment->meta ?? [];
        $decimals = (int) ($meta['display']['decimals'] ?? 8);
        $coin = (string) $payment->coin;
        $txs = $payment->transactions()->get();
        $tx = $txs->where('status', BannerPaymentTransaction::COMPLETED)->last() ?? $txs->last();
        $network = (string) ($meta['display']['network_name'] ?? $payment->network);

        return [
            'expected' => Amount::format((float) $payment->amount, $decimals) . ' ' . $coin,
            'received' => Amount::format((float) $payment->received, $decimals) . ' ' . $coin,
            'network' => $network,
            'tx' => $tx ? (string) ($tx->hash ?: $tx->provider_id) : null,
            'overpaid' => !empty($meta['overpaid']) ? $meta['overpaid'] . ' ' . $coin : null,
            'late_value_usd' => $meta['late_value_usd'] ?? null,
        ];
    }

    /** Send once per order and column: claimed right before sending, released if it fails. */
    private function once(BannerOrder $order, string $column, array|string $to, Mailable $mail): void
    {
        if (!$to || $order->getAttribute($column)) {
            return;
        }

        $this->mail->send(
            $to,
            $mail,
            guard: function () use ($order, $column) {
                $now = now();
                $claimed = BannerOrder::whereKey($order->id)->whereNull($column)->update([$column => $now]) === 1;
                if ($claimed) {
                    $order->setAttribute($column, $now)->syncOriginalAttribute($column);
                }
                return $claimed;
            },
            release: function () use ($order, $column) {
                BannerOrder::whereKey($order->id)->update([$column => null]);
                $order->setAttribute($column, null)->syncOriginalAttribute($column);
            },
        );
    }
}
