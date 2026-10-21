<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/**
 * One font face (a single woff2 file = family + weight + style).
 * Files are immutable: a new upload is a new row and file, so order snapshots stay valid.
 */
class BannerFont extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = ['name', 'weight', 'style', 'path', 'file_size'];

    protected $casts = [
        'weight' => 'integer',
        'file_size' => 'integer',
    ];

    protected $hidden = ['path', 'deleted_at'];

    protected $appends = ['url', 'family'];

    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public function getUrlAttribute(): ?string
    {
        return $this->path ? Storage::disk(config('banners.disks.public'))->url($this->path) : null;
    }

    /**
     * CSS family name used by the preview and the renderer. Never the admin-entered name,
     * so nothing typed in the admin ends up inside CSS.
     */
    public function getFamilyAttribute(): string
    {
        return 'bf-' . $this->id;
    }
}
