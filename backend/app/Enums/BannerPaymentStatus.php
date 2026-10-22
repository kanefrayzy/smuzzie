<?php

namespace App\Enums;

/**
 * State of one deposit address of a banner order (App\Models\BannerPayment).
 *
 *   awaiting -> confirming -> paid
 *       \           \-> underpaid -> (more arrives) -> confirming / paid
 *        \-> review   (late payment that no longer covers the price; the admin decides)
 *
 * Only App\Services\Payments\BannerPaymentService changes it. "Paid" here means the provider
 * confirmed enough money; the order itself goes paid via BannerOrderService::markPaid().
 */
enum BannerPaymentStatus: string
{
    case Awaiting = 'awaiting';     // address shown, nothing received yet
    case Confirming = 'confirming'; // a transaction is seen, waiting for the network
    case Underpaid = 'underpaid';   // completed, but less than the quote
    case Paid = 'paid';
    case Review = 'review';         // needs the admin (late and short at the current rate, or late_policy=review)

    /** Still expecting money for this address. */
    public function isOpen(): bool
    {
        return $this === self::Awaiting || $this === self::Confirming || $this === self::Underpaid;
    }

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
