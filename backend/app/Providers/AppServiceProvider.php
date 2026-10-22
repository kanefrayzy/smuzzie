<?php

namespace App\Providers;

use App\Services\Payments\CryptoPaymentProvider;
use App\Services\Payments\WestWallet\WestWalletProvider;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Crypto payment gateway for the banner checkout (config/banners.php, payments.provider)
        $this->app->bind(CryptoPaymentProvider::class, function () {
            // Only one gateway so far; a new one implements CryptoPaymentProvider and gets a case here
            return match (config('banners.payments.provider')) {
                'westwallet' => new WestWalletProvider(),
                default => new WestWalletProvider(),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
