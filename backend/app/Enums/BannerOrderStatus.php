<?php

namespace App\Enums;

/**
 * pending_payment -> queued -> rendering -> ready | failed
 * Transitions go through App\Services\Banners\BannerOrderService only.
 */
enum BannerOrderStatus: string
{
    case PendingPayment = 'pending_payment';
    case Queued = 'queued';
    case Rendering = 'rendering';
    case Ready = 'ready';
    case Failed = 'failed';

    /** Paid at some point (manual confirmation, auto-approve or a future payment webhook). */
    public function isPaid(): bool
    {
        return $this !== self::PendingPayment;
    }

    /** Waiting for or inside the render worker. */
    public function isInProgress(): bool
    {
        return $this === self::Queued || $this === self::Rendering;
    }

    public function canRerender(): bool
    {
        return $this === self::Ready || $this === self::Failed;
    }

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
