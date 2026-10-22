<?php

namespace App\Services\Payments\WestWallet;

use App\Services\Payments\CryptoPaymentProvider;
use App\Services\Payments\CurrencyInfo;
use App\Services\Payments\DepositAddress;
use App\Services\Payments\IncomingTransaction;
use App\Services\Payments\PaymentProviderException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * WestWallet (https://westwallet.io/api_docs):
 *  - currencies:  GET  /wallet/currencies_data
 *  - rates:       GET  /instant_exchange/rates/user (documented, signed); falls back to the public
 *                 GET /instant_exchange/rates that WestWallet's own site uses
 *  - addresses:   POST /address/generate {currency, ipn_url, label<=30}
 *  - lookup:      POST /wallet/transaction {id} or {label}
 *  - IPN:         form-encoded POST from 45.155.121.88; only its `id` is used, then looked up.
 */
class WestWalletProvider implements CryptoPaymentProvider
{
    public function __construct(private ?WestWalletClient $client = null)
    {
    }

    public function name(): string
    {
        return 'westwallet';
    }

    public function isConfigured(): bool
    {
        return (string) config('services.westwallet.public_key') !== '' && (string) config('services.westwallet.private_key') !== '';
    }

    public function currencies(): array
    {
        $rows = Cache::remember('payments:westwallet:currencies', (int) config('banners.payments.currencies_cache_seconds', 600), function () {
            $list = $this->client()->get('/wallet/currencies_data');
            if (!array_is_list($list)) {
                throw new PaymentProviderException('WestWallet currencies_data: unexpected shape', 'bad_response');
            }
            return $list;
        });

        $map = [];
        foreach ($rows as $row) {
            $tickers = array_values(array_map('strtoupper', array_filter((array) ($row['tickers'] ?? []), 'is_string')));
            if (!$tickers) {
                continue;
            }
            $info = new CurrencyInfo(
                (string) ($row['name'] ?? $tickers[0]),
                $tickers,
                (float) ($row['min_receive'] ?? 0),
                (bool) ($row['require_dest_tag'] ?? false),
                (bool) ($row['active'] ?? false) && (bool) ($row['receive_active'] ?? false),
            );
            foreach ($tickers as $t) {
                $map[$t] = $info;
            }
        }

        return $map;
    }

    public function usdRate(string $ticker): ?float
    {
        $ticker = strtoupper($ticker);
        $quote = strtoupper((string) config('banners.payments.rate_quote_ticker', 'USDTTRC'));
        $mine = $this->aliases($ticker);
        $usd = $this->aliases($quote);
        if (array_intersect($mine, $usd)) {
            return 1.0;
        }

        $rates = $this->rates();
        // coin -> USDT: what WestWallet pays for one coin, fee included (so we never under-quote)
        foreach ($rates as [$from, $to, $rate]) {
            if ($rate > 0 && in_array($from, $mine, true) && in_array($to, $usd, true)) {
                return $rate;
            }
        }
        // USDT -> coin only (e.g. XRP): invert
        foreach ($rates as [$from, $to, $rate]) {
            if ($rate > 0 && in_array($from, $usd, true) && in_array($to, $mine, true)) {
                return 1 / $rate;
            }
        }

        return null;
    }

    public function createAddress(string $ticker, string $label): DepositAddress
    {
        $data = $this->client()->post('/address/generate', [
            'currency' => $ticker,
            'ipn_url' => $this->callbackUrl(),
            'label' => $label,
        ]);

        $address = trim((string) ($data['address'] ?? ''));
        if ($address === '') {
            throw new PaymentProviderException('WestWallet address/generate: no address in the response', 'bad_response');
        }
        $tag = trim((string) ($data['dest_tag'] ?? ''));

        return new DepositAddress($address, $tag !== '' ? $tag : null, strtoupper((string) ($data['currency'] ?? $ticker)), $label, $data);
    }

    public function transaction(string $id): ?IncomingTransaction
    {
        return $this->lookup(['id' => (int) $id]);
    }

    public function transactionByLabel(string $label): ?IncomingTransaction
    {
        return $this->lookup(['label' => $label]);
    }

    public function isTrustedCallback(Request $request): bool
    {
        $ips = (array) config('services.westwallet.ipn_ips', []);
        if ($ips && !in_array($request->ip(), $ips, true)) {
            return false;
        }
        $secret = (string) config('services.westwallet.ipn_secret');
        if ($secret !== '' && !hash_equals($secret, (string) $request->query('secret', ''))) {
            return false;
        }

        return true;
    }

    public function callbackTransactionId(Request $request): ?string
    {
        $id = (string) $request->input('id', '');

        return preg_match('/^[0-9]{1,20}$/', $id) ? $id : null;
    }

    /** The IPN URL sent with every new address. */
    public function callbackUrl(): string
    {
        $url = (string) config('services.westwallet.ipn_url');
        if ($url === '') {
            $url = rtrim((string) config('app.url'), '/') . '/api/v1/payments/westwallet/ipn';
        }
        $secret = (string) config('services.westwallet.ipn_secret');
        if ($secret !== '') {
            $url .= (str_contains($url, '?') ? '&' : '?') . 'secret=' . rawurlencode($secret);
        }

        return $url;
    }

    private function lookup(array $query): ?IncomingTransaction
    {
        try {
            $data = $this->client()->post('/wallet/transaction', $query);
        } catch (PaymentProviderException $e) {
            if ($e->errorCode === 'not_found') {
                return null;
            }
            throw $e;
        }

        return self::parseTransaction($data);
    }

    public static function parseTransaction(array $data): ?IncomingTransaction
    {
        if (!isset($data['id'], $data['currency'], $data['amount'], $data['address'])) {
            return null;
        }
        $status = strtolower((string) ($data['status'] ?? ''));
        $tag = trim((string) ($data['dest_tag'] ?? ''));

        return new IncomingTransaction(
            id: (string) $data['id'],
            incoming: strtolower((string) ($data['type'] ?? 'receive')) === 'receive',
            currency: strtoupper((string) $data['currency']),
            amount: (float) $data['amount'],
            amountRaw: (string) $data['amount'],
            address: trim((string) $data['address']),
            destTag: $tag !== '' ? $tag : null,
            label: isset($data['label']) ? (string) $data['label'] : null,
            // "sending" and "inspection" (held for review by WestWallet) are not final
            status: match ($status) {
                'completed' => IncomingTransaction::COMPLETED,
                'network_error' => IncomingTransaction::FAILED,
                default => IncomingTransaction::PENDING,
            },
            providerStatus: $status,
            confirmations: (int) ($data['blockchain_confirmations'] ?? 0),
            hash: isset($data['blockchain_hash']) && $data['blockchain_hash'] !== '' ? (string) $data['blockchain_hash'] : null,
            raw: $data,
        );
    }

    /** All codes WestWallet uses for the same currency (e.g. TON and GRAM). */
    private function aliases(string $ticker): array
    {
        try {
            $info = $this->currencies()[$ticker] ?? null;
        } catch (PaymentProviderException) {
            $info = null;
        }

        return $info ? $info->tickers : [$ticker];
    }

    /** @return array<int, array{0: string, 1: string, 2: float}> [from, to, rate] */
    private function rates(): array
    {
        $key = 'payments:westwallet:rates';
        $cached = Cache::get($key);
        if (is_array($cached)) {
            return $cached;
        }

        $rates = [];
        try {
            $data = $this->client()->get('/instant_exchange/rates/user');
            foreach ((array) ($data['rates'] ?? []) as $r) {
                $rates[] = [strtoupper((string) ($r['from'] ?? '')), strtoupper((string) ($r['to'] ?? '')), (float) ($r['rate'] ?? 0)];
            }
        } catch (PaymentProviderException $e) {
            Log::channel('payments')->warning('WestWallet user rates unavailable, using the public rates', ['error' => $e->getMessage()]);
        }

        if (!$rates) {
            try {
                $data = $this->client()->get('/instant_exchange/rates', [], false);
                foreach ((array) ($data['results'] ?? []) as $r) {
                    $rates[] = [strtoupper((string) ($r['fromCurrencyCode'] ?? '')), strtoupper((string) ($r['toCurrencyCode'] ?? '')), (float) ($r['rate'] ?? 0)];
                }
            } catch (PaymentProviderException $e) {
                Log::channel('payments')->error('WestWallet rates unavailable', ['error' => $e->getMessage()]);
            }
        }

        if ($rates) {
            Cache::put($key, $rates, (int) config('banners.payments.rates_cache_seconds', 60));
        }

        return $rates;
    }

    private function client(): WestWalletClient
    {
        return $this->client ??= WestWalletClient::fromConfig();
    }
}
