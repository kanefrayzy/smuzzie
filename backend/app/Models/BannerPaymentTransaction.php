<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An incoming transaction to a BannerPayment address, as reported by the provider's API
 * (never by the notification body). Unique per provider transaction id, so a repeated
 * notification updates the same row.
 */
class BannerPaymentTransaction extends Model
{
    public const PENDING = 'pending';
    public const COMPLETED = 'completed';
    public const FAILED = 'failed';

    protected $fillable = [
        'payment_id', 'provider', 'provider_id', 'currency', 'amount', 'status', 'provider_status',
        'confirmations', 'hash', 'first_seen_at', 'completed_at', 'raw',
    ];

    protected $casts = [
        'amount' => 'decimal:12',
        'confirmations' => 'integer',
        'first_seen_at' => 'datetime',
        'completed_at' => 'datetime',
        'raw' => 'array',
    ];

    public function payment()
    {
        return $this->belongsTo(BannerPayment::class, 'payment_id');
    }
}
