<?php

namespace App\Services\Payments;

/**
 * Coin amounts. Quotes are rounded up (the merchant never receives less than the price) and
 * printed without trailing zeros. Floats are fine at these sizes: the comparisons that matter
 * go through the underpayment tolerance.
 */
final class Amount
{
    public static function ceil(float $value, int $decimals): float
    {
        $f = 10 ** $decimals;
        // round() first so 15.000000000002 * 100 doesn't become 1501
        return ceil(round($value * $f, 6)) / $f;
    }

    public static function format(float|string|null $value, int $decimals = 12): string
    {
        $s = number_format((float) $value, $decimals, '.', '');
        if (str_contains($s, '.')) {
            $s = rtrim(rtrim($s, '0'), '.');
        }

        return $s === '-0' ? '0' : $s;
    }
}
