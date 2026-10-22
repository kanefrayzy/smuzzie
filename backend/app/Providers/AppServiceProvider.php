<?php

namespace App\Providers;

use App\Services\Mail\MailSender;
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
        // Holds the emails of the current request until the response is out (one per app instance)
        $this->app->singleton(MailSender::class);

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
