<?php

namespace Tests\Feature\Banners\Payments;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * In-memory stand-in for api.westwallet.io behind Http::fake(). Shapes follow the API docs
 * and what the live API returned for currencies_data and the rates (2026-10-22).
 */
class FakeWestWallet
{
    /** @var array<string, array> transaction id => API response */
    public array $transactions = [];

    /** @var array<string, array> label => API response */
    public array $byLabel = [];

    public array $rates = [
        ['from' => 'BTC', 'to' => 'USDTTRC', 'rate' => 80000],
        ['from' => 'USDTTRC', 'to' => 'XRP', 'rate' => 0.8], // XRP only this way: 1 XRP = 1.25 USD
        ['from' => 'GRAM', 'to' => 'USDTTRC', 'rate' => 1.5],
    ];

    public int $generated = 0;

    public bool $down = false;

    public static function install(): self
    {
        $fake = new self();
        Http::fake(fn (Request $request) => $fake->handle($request));
        return $fake;
    }

    public function handle(Request $request)
    {
        if ($this->down) {
            return Http::response('Bad gateway', 502);
        }
        $path = parse_url($request->url(), PHP_URL_PATH);
        $data = json_decode($request->body(), true) ?: [];

        return match ($path) {
            '/wallet/currencies_data' => Http::response($this->currencies()),
            '/instant_exchange/rates/user' => Http::response(['rates' => $this->rates]),
            '/address/generate' => Http::response($this->generate($data)),
            '/wallet/transaction' => Http::response($this->lookup($data)),
            default => Http::response(['error' => 'not_found'], 404),
        };
    }

    /** A receive transaction as /wallet/transaction returns it. */
    public function tx(int $id, string $currency, string $amount, string $address, string $label, string $status = 'completed', string $destTag = ''): array
    {
        return $this->transactions[(string) $id] = [
            'id' => $id,
            'type' => 'receive',
            'amount' => (float) $amount,
            'address' => $address,
            'dest_tag' => $destTag,
            'label' => $label,
            'currency' => $currency,
            'status' => $status,
            'blockchain_confirmations' => $status === 'completed' ? 20 : 1,
            'blockchain_hash' => 'hash' . $id,
            'fee' => '0',
            'error' => 'ok',
        ];
    }

    private function generate(array $data): array
    {
        $this->generated++;
        $currency = $data['currency'];
        $address = match ($currency) {
            'BTC' => 'bc1qtestaddress' . $this->generated,
            'XRP' => 'rTestXrpAddress' . $this->generated,
            default => 'TTestTronAddress' . $this->generated,
        };

        return [
            'address' => $address,
            'dest_tag' => $currency === 'XRP' ? '7755' . $this->generated : '',
            'currency' => $currency,
            'label' => $data['label'],
            'error' => 'ok',
        ];
    }

    private function lookup(array $data): array
    {
        if (isset($data['id'])) {
            return $this->transactions[(string) $data['id']] ?? ['error' => 'not_found'];
        }
        return $this->byLabel[$data['label'] ?? ''] ?? ['error' => 'not_found'];
    }

    private function currencies(): array
    {
        $row = fn (string $name, array $tickers, string $min, bool $tag = false, bool $receive = true) => [
            'active' => true, 'name' => $name, 'tickers' => $tickers, 'min_receive' => $min,
            'require_dest_tag' => $tag, 'receive_active' => $receive, 'send_active' => true,
            'address_regex' => '.*', 'fee' => '0', 'min_withdraw' => '1',
        ];

        return [
            $row('Bitcoin', ['BTC'], '0.00008'),
            $row('Tether ERC-20', ['USDT', 'USDTERC', 'USDTERC20'], '20'),
            $row('Tether TRC-20', ['USDTTRC', 'USDTTRC20'], '10'),
            $row('Ripple', ['XRP'], '0.5', true),
            $row('Gram', ['GRAM', 'TON'], '0.3'),
            $row('Tether BEP-20', ['USDTBEP', 'USDTBEP20'], '1', false, false), // receiving switched off
        ];
    }
}
