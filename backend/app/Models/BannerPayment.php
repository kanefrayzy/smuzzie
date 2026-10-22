<?php

namespace App\Models;

use App\Enums\BannerPaymentStatus;
use Illuminate\Database\Eloquent\Model;

/**
 * A deposit address for one banner order and one payment method (coin + network),
 * with the locked quote. Changed only by App\Services\Payments\BannerPaymentService.
 */
class BannerPayment extends Model
{
    protected $fillable = [
        'order_id', 'provider', 'method', 'currency', 'coin', 'network',
        'address', 'dest_tag', 'label', 'status',
        'amount_usd', 'rate', 'amount', 'received',
        'quoted_at', 'expires_at', 'selected_at', 'detected_at', 'paid_at', 'last_checked_at', 'meta',
    ];

    protected $casts = [
        'status' => BannerPaymentStatus::class,
        'amount_usd' => 'decimal:2',
        'rate' => 'decimal:10',
        'amount' => 'decimal:12',
        'received' => 'decimal:12',
        'quoted_at' => 'datetime',
        'expires_at' => 'datetime',
        'selected_at' => 'datetime',
        'detected_at' => 'datetime',
        'paid_at' => 'datetime',
        'last_checked_at' => 'datetime',
        'meta' => 'array',
    ];

    protected $attributes = [
        'status' => 'awaiting',
        'received' => 0,
    ];

    public function order()
    {
        return $this->belongsTo(BannerOrder::class, 'order_id');
    }

    public function transactions()
    {
        return $this->hasMany(BannerPaymentTransaction::class, 'payment_id')->orderBy('id');
    }

    /** The price lock is over (only meaningful while nothing has been received). */
    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
