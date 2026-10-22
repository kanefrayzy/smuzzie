<?php

namespace App\Console\Commands;

use App\Services\Payments\Amount;
use App\Services\Payments\PaymentProviderException;
use App\Services\Payments\WestWallet\WestWalletClient;
use App\Services\Payments\WestWallet\WestWalletProvider;
use Illuminate\Console\Command;

/**
 * Read-only check of the WestWallet setup: keys, signature, the key's IP allowlist, rates and
 * the IPN URL. Makes no address and moves no money.
 */
class WestWalletCheckCommand extends Command
{
    protected $signature = 'payments:westwallet-check';

    protected $description = 'Check the WestWallet API keys, signature and rates (read-only)';

    public function handle(): int
    {
        $provider = new WestWalletProvider();
        if (!$provider->isConfigured()) {
            $this->error('WESTWALLET_PUBLIC_KEY / WESTWALLET_PRIVATE_KEY are not set.');
            return self::FAILURE;
        }
        $client = WestWalletClient::fromConfig();
        $ok = true;

        // 1. Signed request: "not_found" for a transaction id that isn't ours means the key,
        //    the HMAC and the IP allowlist all passed.
        try {
            $client->post('/wallet/transaction', ['id' => 1]);
            $this->info('Signed request: OK');
        } catch (PaymentProviderException $e) {
            if ($e->errorCode === 'not_found') {
                $this->info('Signed request: OK (key, signature and IP accepted)');
            } else {
                $ok = false;
                $this->error('Signed request failed: ' . $e->errorCode . ' (wrong_auth = public key, wrong_hmac = private key, ip_not_allowed = add this server\'s IP to the key)');
            }
        }

        // 2. Currencies and rates the checkout uses
        $currencies = [];
        try {
            $currencies = $provider->currencies();
            $this->info('Currencies: ' . count(array_unique(array_map(fn ($c) => $c->name, $currencies))));
        } catch (PaymentProviderException $e) {
            $ok = false;
            $this->error('Currencies failed: ' . $e->getMessage());
        }

        try {
            $user = $client->get('/instant_exchange/rates/user');
            $this->info('User rates: ' . count((array) ($user['rates'] ?? [])) . ' directions');
        } catch (PaymentProviderException $e) {
            $this->warn('User rates failed (' . $e->errorCode . '); the public rates are used instead');
        }

        $rows = [];
        foreach ((array) config('banners.payments.methods') as $m) {
            $info = $currencies[strtoupper($m['ticker'])] ?? null;
            $rate = in_array($m['coin'], (array) config('banners.payments.usd_pegged'), true) ? 1.0 : $provider->usdRate($m['ticker']);
            $rows[] = [$m['key'], $m['ticker'], $info ? ($info->canReceive ? 'yes' : 'no') : 'missing', $info ? Amount::format($info->minReceive) : '-', $rate ? Amount::format($rate, 6) : 'NO RATE'];
        }
        $this->table(['method', 'ticker', 'receive', 'min', 'USD rate'], $rows);

        $this->line('IPN URL sent with new addresses: ' . preg_replace('/secret=[^&]+/', 'secret=***', $provider->callbackUrl()));
        $this->line('IPN accepted from: ' . (implode(', ', (array) config('services.westwallet.ipn_ips')) ?: 'any IP (check disabled)'));

        return $ok ? self::SUCCESS : self::FAILURE;
    }
}
