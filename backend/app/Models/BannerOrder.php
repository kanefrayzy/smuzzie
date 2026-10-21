<?php

namespace App\Models;

use App\Enums\BannerOrderStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A buyer's banner order. `snapshot` is the full template at order time and the only
 * thing the renderer reads, so later template edits never change an existing order.
 * Status changes go through App\Services\Banners\BannerOrderService.
 */
class BannerOrder extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'template_id', 'is_test', 'email', 'status',
        'params', 'snapshot', 'images',
        'amount', 'currency', 'payment_provider', 'payment_reference',
        'paid_at', 'queued_at', 'rendering_started_at', 'ready_at', 'failed_at', 'notified_at', 'result_purged_at',
        'attempts', 'error', 'render_log', 'result', 'ip',
    ];

    protected $casts = [
        'is_test' => 'boolean',
        'status' => BannerOrderStatus::class,
        'params' => 'array',
        'snapshot' => 'array',
        'images' => 'array',
        'result' => 'array',
        'amount' => 'decimal:2',
        'attempts' => 'integer',
        'paid_at' => 'datetime',
        'queued_at' => 'datetime',
        'rendering_started_at' => 'datetime',
        'ready_at' => 'datetime',
        'failed_at' => 'datetime',
        'notified_at' => 'datetime',
        'result_purged_at' => 'datetime',
    ];

    protected $attributes = [
        'status' => 'pending_payment',
        'is_test' => false,
        'attempts' => 0,
        'currency' => 'USD',
    ];

    protected $hidden = ['ip', 'render_log'];

    public function uniqueIds(): array
    {
        return ['token'];
    }

    public function template()
    {
        return $this->belongsTo(BannerTemplate::class, 'template_id')->withTrashed();
    }

    /** Buyer orders, without admin test renders. */
    public function scopeReal(Builder $query): Builder
    {
        return $query->where('is_test', false);
    }

    public function scopeStatus(Builder $query, BannerOrderStatus|string $status): Builder
    {
        return $query->where('status', $status instanceof BannerOrderStatus ? $status->value : $status);
    }

    /** Formats (mp4/gif) whose result files are currently available for download. */
    public function resultFormats(): array
    {
        if ($this->status !== BannerOrderStatus::Ready || $this->result_purged_at) {
            return [];
        }
        return array_values(array_filter(['mp4', 'gif'], fn ($f) => !empty($this->result[$f]['path'])));
    }
}
