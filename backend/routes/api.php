<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\PortfolioController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\Admin\BannerFontController;
use App\Http\Controllers\Api\BannerCatalogController;
use App\Http\Controllers\Api\BannerOrderController;
use App\Http\Controllers\Api\Admin\BannerOrderController as AdminBannerOrderController;
use App\Http\Controllers\Api\Admin\BannerTemplateController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::prefix('v1')->group(function () {

    // Auth — rate limiting to prevent brute force
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/auth/login', [AuthController::class, 'login']);
    });

    // Public portfolio
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/categories/{category}', [CategoryController::class, 'show']);
    Route::get('/portfolio', [PortfolioController::class, 'index']);
    Route::get('/portfolio/{portfolioItem}', [PortfolioController::class, 'show']);

    // Public reviews
    Route::get('/reviews', [ReviewController::class, 'index']);

    // Contact form — rate limited to prevent spam
    Route::middleware('throttle:3,1')->group(function () {
        Route::post('/contact', [ContactController::class, 'store']);
    });

    // Banner builder catalog (no auth; only published templates)
    Route::get('/banners/templates', [BannerCatalogController::class, 'index']);
    Route::get('/banners/templates/{slug}', [BannerCatalogController::class, 'show'])
        ->where('slug', '[a-z0-9-]+');

    // Banner orders: creation is rate limited per IP, status by the unguessable token,
    // files only through temporary signed URLs
    Route::post('/banners/orders', [BannerOrderController::class, 'store'])->middleware('throttle:banner-orders');
    Route::middleware('throttle:banner-status')->group(function () {
        Route::get('/banners/orders/{token}', [BannerOrderController::class, 'show'])->whereUuid('token');
        Route::get('/banners/orders/{token}/download/{format}', [BannerOrderController::class, 'download'])
            ->whereUuid('token')->whereIn('format', ['mp4', 'gif'])
            ->middleware('signed')->name('banners.download');
        Route::get('/banners/orders/{token}/image/{key}', [BannerOrderController::class, 'image'])
            ->whereUuid('token')->where('key', '[a-z][a-z0-9_]{0,31}')
            ->middleware('signed')->name('banners.image');
    });

    // Admin routes (protected)
    Route::middleware(['auth:api', 'admin'])->prefix('admin')->group(function () {

        // Auth
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/refresh', [AuthController::class, 'refresh']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        // Dashboard
        Route::get('/dashboard', [DashboardController::class, 'stats']);

        // Categories CRUD
        Route::apiResource('/categories', CategoryController::class);

        // Portfolio CRUD
        Route::apiResource('/portfolio', PortfolioController::class)
            ->parameters(['portfolio' => 'portfolioItem']);
        Route::patch('/portfolio/{portfolioItem}/toggle', [PortfolioController::class, 'toggleField']);
        Route::post('/portfolio/bulk-upload', [PortfolioController::class, 'bulkUpload']);
        Route::post('/portfolio/bulk-delete', [PortfolioController::class, 'bulkDelete']);
        Route::post('/portfolio/reorder', [PortfolioController::class, 'reorder']);
        Route::post('/portfolio/regenerate-thumbnails', [PortfolioController::class, 'regenerateThumbnails']);

        // Reviews CRUD
        Route::apiResource('/reviews', ReviewController::class);

        // Contact submissions
        Route::get('/contacts', [ContactController::class, 'index']);
        Route::get('/contacts/{contactSubmission}', [ContactController::class, 'show']);
        Route::patch('/contacts/{contactSubmission}/status', [ContactController::class, 'updateStatus']);
        Route::delete('/contacts/{contactSubmission}', [ContactController::class, 'destroy']);

        // Banner builder: fonts and templates
        Route::get('/banner-fonts', [BannerFontController::class, 'index']);
        Route::post('/banner-fonts', [BannerFontController::class, 'store']);
        Route::put('/banner-fonts/{bannerFont}', [BannerFontController::class, 'update']);
        Route::delete('/banner-fonts/{bannerFont}', [BannerFontController::class, 'destroy']);

        Route::post('/banner-templates/reorder', [BannerTemplateController::class, 'reorder']);
        Route::apiResource('/banner-templates', BannerTemplateController::class)
            ->parameters(['banner-templates' => 'bannerTemplate']);
        Route::post('/banner-templates/{bannerTemplate}/source', [BannerTemplateController::class, 'uploadSource']);
        Route::post('/banner-templates/{bannerTemplate}/reprocess', [BannerTemplateController::class, 'reprocess']);

        // Banner orders
        Route::get('/banner-orders', [AdminBannerOrderController::class, 'index']);
        Route::get('/banner-orders/{bannerOrder}', [AdminBannerOrderController::class, 'show']);
        Route::post('/banner-orders/{bannerOrder}/mark-paid', [AdminBannerOrderController::class, 'markPaid']);
        Route::post('/banner-orders/{bannerOrder}/rerender', [AdminBannerOrderController::class, 'rerender']);
    });
});
