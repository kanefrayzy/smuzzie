<?php

namespace App\Mail;

use App\Models\BannerOrder;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * To MAIL_ADMIN_ADDRESS: a crypto payment that needs a human. $reason is one of
 * BannerNotifications::REVIEW_REASONS: underpaid, late, late_short, already_paid.
 */
class AdminPaymentReviewMail extends SiteMail
{
    public function __construct(public BannerOrder $order, public string $reasonKey, public array $payment = [])
    {
    }

    public function envelope(): Envelope
    {
        return $this->adminEnvelope(self::label($this->reasonKey) . ': order #' . self::orderNumber($this->order));
    }

    public function content(): Content
    {
        $o = $this->order;
        $p = $this->payment;

        return $this->page('admin-payment-review', self::label($this->reasonKey), self::label($this->reasonKey) . ' for order #' . self::orderNumber($o) . ' (' . self::templateName($o) . ').', [
            'heading' => self::label($this->reasonKey),
            'explanation' => $this->explanation(),
            'orderNumber' => self::orderNumber($o),
            'adminUrl' => self::adminOrdersUrl(),
            'rows' => [
                ['Order', '#' . self::orderNumber($o)],
                ['Template', self::templateName($o)],
                ['Price', self::price($o)],
                ['Buyer', (string) $o->email],
                ['Order status', str_replace('_', ' ', $o->status?->value ?? '')],
                ['Network', $p['network'] ?? null],
                ['Expected', $p['expected'] ?? null],
                ['Received', $p['received'] ?? null],
                ['Value now', isset($p['late_value_usd']) ? '$' . number_format((float) $p['late_value_usd'], 2) : null],
                ['Overpaid', $p['overpaid'] ?? null],
                ['Transaction', $p['tx'] ?? null, 'mono'],
            ],
        ]);
    }

    public static function label(string $reason): string
    {
        return match ($reason) {
            'underpaid' => 'Underpaid crypto payment',
            'late', 'late_short' => 'Late payment needs review',
            'already_paid' => 'Second payment for a paid order',
            default => 'Payment needs review',
        };
    }

    private function explanation(): string
    {
        $o = $this->order;

        return match ($this->reasonKey) {
            'underpaid' => 'The buyer sent less than the quote. The order stays unpaid; the buyer sees the remaining amount and can send it to the same address. If they don\'t, you may want to contact them or confirm the payment by hand.',
            'late' => 'The payment arrived after the price lock ended, and BANNERS_PAYMENT_LATE_POLICY=review leaves late payments to you. Confirm the payment in the admin or refund it manually.',
            'late_short' => 'The payment arrived after the price lock ended and at the current rate it no longer covers the price. Confirm the payment in the admin anyway, ask the buyer for the difference, or refund it manually.',
            'already_paid' => 'This order was already paid (' . AdminOrderPaidMail::providerName((string) $o->payment_provider) . ') when this payment completed, so the buyer has paid twice. There is no automatic refund: send it back manually if needed.',
            default => 'Open the order in the admin to check the payment.',
        };
    }

    protected function reason(): string
    {
        return 'Admin notification for ' . self::siteHost() . ' (MAIL_ADMIN_ADDRESS).';
    }
}
