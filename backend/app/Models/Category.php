<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'icon',
        'description',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function portfolioItems()
    {
        return $this->hasMany(PortfolioItem::class);
    }

    public function activeItems()
    {
        return $this->hasMany(PortfolioItem::class)->where('is_active', true);
    }
}
