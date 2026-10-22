<?php

namespace App\Services\Payments;

/** A transaction as returned by the gateway's API, normalized. */
final class IncomingTransaction
{
    public const PENDING = 'pending';
    public const COMPLETED = 'completed';
    public const FAILED = 'failed';

    public function __construct(
        public readonly string $id,
        public readonly bool $incoming,      // false for withdrawals
        public readonly string $currency,
        public readonly float $amount,
        public readonly string $amountRaw,   // exactly as the gateway sent it
        public readonly string $address,
        public readonly ?string $destTag,
        public readonly ?string $label,
        public readonly string $status,      // one of the constants above
        public readonly string $providerStatus,
        public readonly int $confirmations,
        public readonly ?string $hash,
        public readonly array $raw = [],
    ) {
    }
}
