<?php

namespace App\Services\Payments;

final class DepositAddress
{
    public function __construct(
        public readonly string $address,
        public readonly ?string $destTag,
        public readonly string $currency,
        public readonly string $label,
        public readonly array $raw = [],
    ) {
    }
}
