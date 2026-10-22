<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Banner orders (each carries an uploaded logo and may start a render). The two limits
        // need different keys, otherwise they share one counter.
        RateLimiter::for('banner-orders', function (Request $request) {
            $limits = config('banners.rate_limits');
            return [
                Limit::perMinute($limits['orders_per_minute'])->by('minute:' . $request->ip()),
                Limit::perDay($limits['orders_per_day'])->by('day:' . $request->ip()),
            ];
        });
        RateLimiter::for('banner-status', function (Request $request) {
            return Limit::perMinute(config('banners.rate_limits.status_per_minute'))->by($request->ip());
        });

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}
