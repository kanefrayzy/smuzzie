<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\PortfolioController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\DashboardController;

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
    });
});
