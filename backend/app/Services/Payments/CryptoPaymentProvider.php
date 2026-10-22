<?php

namespace App\Services\Payments;

use Illuminate\Http\Request;

/**
 * What the banner checkout needs from a crypto payment gateway. Business rules (quotes,
 * tolerance, late payments, marking the order paid) live in BannerPaymentService, so another
 * gateway only has to implement this.
 */
interface CryptoPaymentProvider
{
    /** Short id stored with payments, e.g. "westwallet". */
    public function name(): string;

    /** Credentials are present. Checkout shows "payments unavailable" otherwise. */
    public function isConfigured(): bool;

    /**
     * Currencies the gateway accepts right now, keyed by every ticker it uses for them.
     *
     * @return array<string, CurrencyInfo>
     * @throws PaymentProviderException
     */
    public function currencies(): array;

    /** USD value of one unit of the currency at the gateway's current rate, null if unknown. */
    public function usdRate(string $ticker): ?float;

    /**
     * Create a deposit address that notifies our callback URL about incoming transactions.
     *
     * @throws PaymentProviderException
     */
    public function createAddress(string $ticker, string $label): DepositAddress;

    /**
     * Look a transaction up by its gateway id. This, not a callback body, is the source of truth.
     *
     * @throws PaymentProviderException
     */
    public function transaction(string $id): ?IncomingTransaction;

    /**
     * Latest incoming transaction for an address label; lets the scheduled sync catch
     * payments whose notification never arrived.
     *
     * @throws PaymentProviderException
     */
    public function transactionByLabel(string $label): ?IncomingTransaction;

    /** Whether a callback request comes from the gateway (IP allowlist, shared secret). */
    public function isTrustedCallback(Request $request): bool;

    /** Transaction id a callback refers to; everything else in the body is ignored. */
    public function callbackTransactionId(Request $request): ?string;
}
