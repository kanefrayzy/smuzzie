<?php

namespace App\Models;

use App\Enums\BannerTemplateStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/**
 * A banner template: AE video without text + zones config (docs/banners/PLAN.md §2).
 * Source files are private; only the watermarked preview and the poster are public.
 */
class BannerTemplate extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'slug', 'name', 'description', 'price', 'currency', 'is_active', 'sort_order',
        'config', 'outputs', 'watermark',
        'source_rev', 'upload_path', 'source_path', 'preview_path', 'poster_path',
        'width', 'height', 'frame_count', 'duration', 'fps',
        'processing_status', 'processing_error', 'processed_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'config' => 'array',
        'outputs' => 'array',
        'watermark' => 'array',
        'source_rev' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'frame_count' => 'integer',
        'duration' => 'float',
        'fps' => 'float',
        'processing_status' => BannerTemplateStatus::class,
        'processed_at' => 'datetime',
    ];

    protected $attributes = [
        'processing_status' => 'none',
        'is_active' => false,
        'sort_order' => 0,
        'source_rev' => 0,
        'currency' => 'USD',
    ];

    // File locations never leave the backend; the public URLs are appended instead
    protected $hidden = ['upload_path', 'source_path', 'preview_path', 'poster_path', 'deleted_at'];

    protected $appends = ['preview_url', 'poster_url'];

    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public function orders()
    {
        return $this->hasMany(BannerOrder::class, 'template_id');
    }

    /**
     * Visible in the public catalog: switched on by the admin and a processed video exists.
     * Re-processing a new upload doesn't hide the template; the old media is served until the
     * new files are complete.
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('is_active', true)
            ->whereNotNull('source_path')
            ->whereNotNull('preview_path');
    }

    public function isPublished(): bool
    {
        return $this->is_active && $this->hasMedia();
    }

    public function hasMedia(): bool
    {
        return $this->source_path !== null && $this->preview_path !== null;
    }

    public function getPreviewUrlAttribute(): ?string
    {
        return $this->publicUrl($this->preview_path);
    }

    public function getPosterUrlAttribute(): ?string
    {
        return $this->publicUrl($this->poster_path);
    }

    /** @return int[] font ids referenced by text zones */
    public function fontIds(): array
    {
        $ids = [];
        foreach ($this->config['zones'] ?? [] as $zone) {
            if (($zone['type'] ?? null) === 'text' && isset($zone['style']['fontId'])) {
                $ids[] = (int) $zone['style']['fontId'];
            }
        }
        return array_values(array_unique($ids));
    }

    private function publicUrl(?string $path): ?string
    {
        return $path ? Storage::disk(config('banners.disks.public'))->url($path) : null;
    }
}
