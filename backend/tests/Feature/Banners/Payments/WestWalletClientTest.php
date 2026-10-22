<?php

namespace Tests\Feature\Banners\Payments;

use App\Services\Payments\PaymentProviderException;
use App\Services\Payments\WestWallet\WestWalletClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Request signing as in the WestWallet docs ("Authorization"). */
class WestWalletClientTest extends TestCase
{
    private function client(): WestWalletClient
    {
        return new WestWalletClient('test-public', 'test-private', 'https://api.westwallet.io', 5);
    }

    public function test_signature_matches_the_documented_algorithm(): void
    {
        // Vectors computed with Python's hmac, as in the docs' example (timestamp + JSON body)
        $this->assertSame('384f187186ba71c5e66ea003c87fe77277b2a3ff6bdeb3f1007894d4c557daeb', WestWalletClient::sign('your_private_key', 1700000000, '{"id":435}'));
        $this->assertSame('eac40e32c05caa9c5f09511633776d8177c7f971773ab60a2aaa51226484c8bb', WestWalletClient::sign('your_private_key', 1700000000, ''));
    }

    public function test_post_signs_timestamp_and_exact_body(): void
    {
        Http::fake(['*' => Http::response(['id' => 5, 'error' => 'ok'])]);

        $this->client()->post('/address/generate', ['currency' => 'BTC', 'ipn_url' => 'https://shop.test/api/v1/ipn?secret=a', 'label' => 'abc']);

        Http::assertSent(function (Request $r) {
            $ts = (int) $r->header('X-ACCESS-TIMESTAMP')[0];
            $body = '{"currency":"BTC","ipn_url":"https://shop.test/api/v1/ipn?secret=a","label":"abc"}'; // slashes unescaped
            return $r->method() === 'POST'
                && $r->url() === 'https://api.westwallet.io/address/generate'
                && $r->body() === $body
                && $r->header('Content-Type')[0] === 'application/json'
                && $r->header('X-API-KEY')[0] === 'test-public'
                && abs($ts - time()) <= 5
                && $r->header('X-ACCESS-SIGN')[0] === hash_hmac('sha256', $ts . $body, 'test-private');
        });
    }

    public function test_get_without_params_signs_only_the_timestamp(): void
    {
        Http::fake(['*' => Http::response([['name' => 'Bitcoin', 'tickers' => ['BTC']]])]);

        $list = $this->client()->get('/wallet/currencies_data');

        $this->assertSame('Bitcoin', $list[0]['name']);
        Http::assertSent(function (Request $r) {
            $ts = $r->header('X-ACCESS-TIMESTAMP')[0];
            return $r->method() === 'GET' && $r->header('X-ACCESS-SIGN')[0] === hash_hmac('sha256', $ts, 'test-private');
        });
    }

    public function test_unsigned_get_sends_no_credentials(): void
    {
        Http::fake(['*' => Http::response(['results' => []])]);

        $this->client()->get('/instant_exchange/rates', [], false);

        Http::assertSent(fn (Request $r) => !$r->hasHeader('X-API-KEY') && !$r->hasHeader('X-ACCESS-SIGN'));
    }

    public function test_api_errors_become_exceptions_with_the_code(): void
    {
        Http::fake(['*' => Http::response(['error' => 'wrong_hmac'])]);
        try {
            $this->client()->post('/wallet/transaction', ['id' => 1]);
            $this->fail('expected an exception');
        } catch (PaymentProviderException $e) {
            $this->assertSame('wrong_hmac', $e->errorCode);
        }
    }

    public function test_non_json_and_http_errors_become_exceptions(): void
    {
        Http::fake(['*' => Http::response('<html>Bad gateway</html>', 502)]);
        $this->expectException(PaymentProviderException::class);
        $this->client()->post('/wallet/transaction', ['id' => 1]);
    }
}
