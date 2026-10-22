<?php

namespace App\Services\Payments\WestWallet;

use App\Services\Payments\PaymentProviderException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Signed HTTP calls to https://api.westwallet.io, as in the API docs ("Authorization"):
 *
 *   X-API-KEY          public key
 *   X-ACCESS-TIMESTAMP unix timestamp (seconds)
 *   X-ACCESS-SIGN      hex HMAC-SHA256(private key, timestamp . payload)
 *
 * The payload is the JSON request body exactly as sent (compact, slashes unescaped, like the
 * official PHP client), or the JSON of the query parameters for GET; with no data it is empty,
 * so only the timestamp is signed.
 *
 * Only read-only and address-generation endpoints are used. Withdrawals are deliberately absent.
 */
class WestWalletClient
{
    public function __construct(
        private string $publicKey,
        private string $privateKey,
        private string $baseUrl = 'https://api.westwallet.io',
        private int $timeout = 15,
    ) {
    }

    public static function fromConfig(): self
    {
        $c = config('services.westwallet');

        return new self((string) $c['public_key'], (string) $c['private_key'], $c['base_url'], (int) $c['timeout']);
    }

    public static function encode(array $data): string
    {
        return $data ? json_encode($data, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) : '';
    }

    public static function sign(string $privateKey, int $timestamp, string $payload): string
    {
        return hash_hmac('sha256', $timestamp . $payload, $privateKey);
    }

    /** @throws PaymentProviderException */
    public function get(string $path, array $query = [], bool $signed = true): array
    {
        $request = Http::timeout($this->timeout)->acceptJson();
        if ($signed) {
            $request = $request->withHeaders($this->headers(self::encode($query)));
        }

        return $this->send(fn () => $request->get($this->baseUrl . $path, $query), $path);
    }

    /** @throws PaymentProviderException */
    public function post(string $path, array $data): array
    {
        $body = self::encode($data);
        $request = Http::timeout($this->timeout)->acceptJson()
            ->withHeaders($this->headers($body))
            ->withBody($body, 'application/json');

        return $this->send(fn () => $request->post($this->baseUrl . $path), $path);
    }

    private function headers(string $payload): array
    {
        $timestamp = time();

        return [
            'X-API-KEY' => $this->publicKey,
            'X-ACCESS-SIGN' => self::sign($this->privateKey, $timestamp, $payload),
            'X-ACCESS-TIMESTAMP' => (string) $timestamp,
        ];
    }

    /**
     * Every WestWallet response carries "error": "ok" on success (lists, like currencies_data,
     * don't). Anything else becomes an exception with that code.
     */
    private function send(callable $call, string $path): array
    {
        try {
            /** @var Response $response */
            $response = $call();
        } catch (ConnectionException $e) {
            throw new PaymentProviderException("WestWallet {$path}: " . $e->getMessage(), 'connection', $e);
        }

        $json = $response->json();
        if (!is_array($json)) {
            throw new PaymentProviderException("WestWallet {$path}: HTTP {$response->status()}, not JSON", 'bad_response');
        }

        $error = $json['error'] ?? null;
        if ($error !== null && $error !== 'ok') {
            throw new PaymentProviderException("WestWallet {$path}: {$error}", is_string($error) ? $error : 'error');
        }
        if (!$response->successful()) {
            throw new PaymentProviderException("WestWallet {$path}: HTTP {$response->status()}", 'http_' . $response->status());
        }

        return $json;
    }
}
