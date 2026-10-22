<?php

namespace App\Services\Payments;

/** A currency as the gateway describes it (WestWallet: one entry of currencies_data). */
final class CurrencyInfo
{
    /**
     * @param string[] $tickers every code the gateway uses for this currency
     */
    public function __construct(
        public readonly string $name,
        public readonly array $tickers,
        public readonly float $minReceive,
        public readonly bool $requiresTag,
        public readonly bool $canReceive,
    ) {
    }
}
