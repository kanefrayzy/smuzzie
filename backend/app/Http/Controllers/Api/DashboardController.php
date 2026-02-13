<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\PortfolioItem;
use App\Models\Review;
use App\Models\ContactSubmission;

class DashboardController extends Controller
{
    public function stats()
    {
        return response()->json([
            'total_categories' => Category::count(),
            'total_items' => PortfolioItem::count(),
            'active_items' => PortfolioItem::active()->count(),
            'featured_items' => PortfolioItem::featured()->count(),
            'total_reviews' => Review::count(),
            'new_contacts' => ContactSubmission::where('status', 'new')->count(),
            'total_contacts' => ContactSubmission::count(),
            'categories_breakdown' => Category::withCount('portfolioItems')
                ->orderBy('sort_order')
                ->get(['id', 'name', 'slug', 'icon']),
            'recent_items' => PortfolioItem::with('category')
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get(),
            'recent_contacts' => ContactSubmission::orderBy('created_at', 'desc')
                ->limit(5)
                ->get(['id', 'name', 'email', 'subject', 'status', 'created_at']),
        ]);
    }
}
