<?php

namespace App\Services\Payments;

use App\Enums\BannerOrderStatus;
use App\Enums\BannerPaymentStatus;
use App\Models\BannerOrder;
use App\Models\BannerPayment;
use App\Models\BannerPaymentTransaction;
use App\Services\Banners\BannerOrderService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Crypto checkout for banner orders:
 *
 *  - methodsFor(): what the picker shows (coins the gateway accepts now, with an approximate amount);
 *  - select():     deposit address + locked quote for one method; the address is created once per
 *                  order and method and reused, the quote is renewed only after the lock ran out
 *                  and nothing has arrived;
 *  - handleCallback() / sync(): a transaction id from a notification (or the scheduled sync) is
 *                  looked up through the gateway's API, matched to our address and evaluated.
 *                  When enough has arrived, BannerOrderService::markPaid() moves the order on;
 *                  it is the only way into the paid state and is idempotent.
 *
 * Rules (config/banners.php, payments):
 *  - underpayment: up to underpay_tolerance_percent short still counts as paid; more than that
 *    leaves the payment "underpaid" and the buyer can send the rest to the same address;
 *  - overpayment: accepted, the extra is recorded for the admin (no automatic refund);
 *  - late: a transaction first seen after the lock + late_grace_minutes is handled by
 *    late_policy (USD-pegged coins always keep their quote, their price doesn't move);
 *  - repeated notifications update the same transaction row and never pay twice.
 */
class BannerPaymentService
{
    private const EPSILON = 1e-9;

    public function __construct(private CryptoPaymentProvider $provider, private BannerOrderService $orders)
    {
    }

    public function provider(): CryptoPaymentProvider
    {
        return $this->provider;
    }

    public function isAvailable(): bool
    {
        return $this->provider->isConfigured();
    }

    /** @return array<string, mixed>|null */
    public static function method(string $key): ?array
    {
        foreach ((array) config('banners.payments.methods', []) as $m) {
            if (($m['key'] ?? null) === $key) {
                return $m;
            }
        }
        return null;
    }

    /** Address label: the order token without dashes, cut to WestWallet's 30-character limit. */
    public static function label(BannerOrder $order): string
    {
        return substr(str_replace('-', '', $order->token), 0, 30);
    }

    public static function isPegged(string $coin): bool
    {
        return in_array(strtoupper($coin), array_map('strtoupper', (array) config('banners.payments.usd_pegged', [])), true);
    }

    /**
     * Picker contents for one order.
     *
     * @return array{available: bool, reason: ?string, methods: array<int, array<string, mixed>>}
     */
    public function methodsFor(BannerOrder $order): array
    {
        if (!$this->provider->isConfigured()) {
            return ['available' => false, 'reason' => 'not_configured', 'methods' => []];
        }
        try {
            $currencies = $this->provider->currencies();
        } catch (PaymentProviderException $e) {
            Log::channel('payments')->error('Payment methods unavailable', ['error' => $e->getMessage()]);
            return ['available' => false, 'reason' => 'unavailable', 'methods' => []];
        }

        $usd = (float) $order->amount;
        $methods = [];
        foreach ((array) config('banners.payments.methods', []) as $m) {
            $info = $currencies[strtoupper($m['ticker'])] ?? null;
            if (!$info || !$info->canReceive) {
                continue; // not offered by the gateway right now
            }
            $rate = self::isPegged($m['coin']) ? 1.0 : $this->provider->usdRate($m['ticker']);
            $amount = $rate ? Amount::ceil($usd / $rate, (int) $m['decimals']) : null;
            $reason = null;
            if ($amount === null) {
                $reason = 'Temporarily unavailable';
            } elseif ($info->minReceive > 0 && $amount < $info->minReceive) {
                $reason = 'Minimum deposit is ' . Amount::format($info->minReceive) . ' ' . $m['coin'];
            }
            $methods[] = self::display($m) + [
                'requires_tag' => $info->requiresTag,
                'approx_amount' => $amount !== null ? Amount::format($amount, (int) $m['decimals']) : null,
                'available' => $reason === null,
                'unavailable_reason' => $reason,
            ];
        }

        $any = (bool) array_filter($methods, fn ($m) => $m['available']);

        return ['available' => $any, 'reason' => $any ? null : 'unavailable', 'methods' => $methods];
    }

    /**
     * The buyer picked a method: return its address and a valid quote.
     *
     * @throws PaymentException
     */
    public function select(BannerOrder $order, string $methodKey): BannerPayment
    {
        if (!$this->provider->isConfigured()) {
            throw new PaymentException('Crypto payments are unavailable right now. Please try again later.', 503, 'not_configured');
        }
        $method = self::method($methodKey);
        if (!$method) {
            throw new PaymentException('This payment method is not available.', 422, 'unknown_method');
        }
        if ($order->is_test || strtoupper((string) $order->currency) !== 'USD' || (float) $order->amount <= 0) {
            throw new PaymentException('This order cannot be paid online.', 422, 'not_payable');
        }

        return DB::transaction(function () use ($order, $method) {
            // Serializes double clicks: one address per order + method
            $locked = BannerOrder::whereKey($order->id)->lockForUpdate()->first();
            if (!$locked || $locked->status !== BannerOrderStatus::PendingPayment) {
                throw new PaymentException('This order is already paid.', 409, 'not_pending');
            }

            $payment = $locked->payments()->where('method', $method['key'])->first();
            if ($payment) {
                if ($payment->status === BannerPaymentStatus::Awaiting && $payment->isExpired()) {
                    $quote = $this->quote($locked, $method);
                    $payment->fill($quote);
                }
                $payment->selected_at = now();
                $payment->save();
                return $payment;
            }

            if ($locked->payments()->count() >= (int) config('banners.payments.max_addresses_per_order', 6)) {
                throw new PaymentException('Too many payment methods tried for this order. Please use one you already opened.', 422, 'too_many');
            }

            $info = $this->currencyInfo($method['ticker']);
            if (!$info || !$info->canReceive) {
                throw new PaymentException('This payment method is temporarily unavailable.', 422, 'inactive');
            }
            $quote = $this->quote($locked, $method);
            if ($info->minReceive > 0 && (float) $quote['amount'] < $info->minReceive) {
                throw new PaymentException('The order total is below the minimum deposit for this coin. Please choose another one.', 422, 'below_minimum');
            }

            try {
                $address = $this->provider->createAddress($method['ticker'], self::label($locked));
            } catch (PaymentProviderException $e) {
                Log::channel('payments')->error('Address generation failed', ['order' => $locked->id, 'method' => $method['key'], 'error' => $e->getMessage()]);
                throw new PaymentException('Could not create a payment address. Please try again in a minute.', 503, 'provider_error');
            }
            if ($info->requiresTag && $address->destTag === null) {
                Log::channel('payments')->error('Address without the required tag', ['order' => $locked->id, 'method' => $method['key']]);
                throw new PaymentException('Could not create a payment address. Please choose another coin.', 503, 'provider_error');
            }

            $payment = $locked->payments()->create($quote + [
                'provider' => $this->provider->name(),
                'method' => $method['key'],
                'currency' => strtoupper($method['ticker']),
                'coin' => $method['coin'],
                'network' => $method['network'],
                'address' => $address->address,
                'dest_tag' => $address->destTag,
                'label' => $address->label,
                'status' => BannerPaymentStatus::Awaiting,
                'selected_at' => now(),
                'meta' => ['display' => self::display($method), 'aliases' => $this->aliases($method, $info)],
            ]);
            Log::channel('payments')->info('Address created', ['order' => $locked->id, 'payment' => $payment->id, 'method' => $method['key']]);

            return $payment;
        });
    }

    /**
     * A notification named this transaction id: look it up and apply it.
     *
     * @return string outcome for the log
     * @throws PaymentProviderException when the gateway can't be asked (the caller answers 503)
     */
    public function handleCallback(string $transactionId): string
    {
        $tx = $this->provider->transaction($transactionId);
        if (!$tx) {
            Log::channel('payments')->warning('Notification for an unknown transaction', ['tx' => $transactionId]);
            return 'not_found';
        }
        $payment = $this->apply($tx);

        return $payment ? 'payment:' . $payment->status->value : 'unmatched';
    }

    /**
     * Apply a transaction that came from the gateway's API (never from a callback body).
     * Returns the payment it belongs to, or null when it isn't one of ours.
     */
    public function apply(IncomingTransaction $tx): ?BannerPayment
    {
        $ctx = ['tx' => $tx->id, 'label' => $tx->label, 'currency' => $tx->currency, 'amount' => $tx->amountRaw, 'status' => $tx->providerStatus];
        if (!$tx->incoming) {
            Log::channel('payments')->info('Ignored outgoing transaction', $ctx);
            return null;
        }

        $payment = $this->match($tx);
        if (!$payment) {
            Log::channel('payments')->warning('Transaction matches no payment (label, address, tag or currency differ)', $ctx);
            return null;
        }

        $payment = DB::transaction(function () use ($payment, $tx) {
            $payment = BannerPayment::whereKey($payment->id)->lockForUpdate()->first();

            $row = BannerPaymentTransaction::firstOrNew(['provider' => $this->provider->name(), 'provider_id' => $tx->id]);
            if ($row->exists && $row->payment_id !== $payment->id) {
                return $payment; // never move a transaction between payments
            }
            $row->fill([
                'payment_id' => $payment->id,
                'currency' => $tx->currency,
                'amount' => $tx->amountRaw,
                'status' => $tx->status,
                'provider_status' => $tx->providerStatus,
                'confirmations' => $tx->confirmations,
                'hash' => $tx->hash,
                'raw' => $tx->raw,
            ]);
            if (!$row->exists) {
                $row->first_seen_at = now();
            }
            if ($tx->status === IncomingTransaction::COMPLETED && !$row->completed_at) {
                $row->completed_at = now();
            }
            $row->save();

            if (!$payment->detected_at) {
                $payment->detected_at = $row->first_seen_at;
            }
            $this->evaluate($payment);

            return $payment;
        });

        Log::channel('payments')->info('Transaction applied', $ctx + ['payment' => $payment->id, 'payment_status' => $payment->status->value, 'received' => (string) $payment->received]);

        return $payment;
    }

    /** Re-check an open payment through the API (scheduled; catches lost notifications). */
    public function sync(BannerPayment $payment): void
    {
        $pending = $payment->transactions()->where('status', BannerPaymentTransaction::PENDING)->pluck('provider_id');
        foreach ($pending as $id) {
            if ($tx = $this->provider->transaction((string) $id)) {
                $this->apply($tx);
            }
        }
        if ($pending->isEmpty() && $payment->fresh()->status->isOpen()) {
            if ($tx = $this->provider->transactionByLabel($payment->label)) {
                $this->apply($tx);
            }
        }
        $payment->forceFill(['last_checked_at' => now()])->save();
    }

    // ─── internals ──────────────────────────────────────────────

    private function evaluate(BannerPayment $payment): void
    {
        $txs = $payment->transactions()->get();
        $completedTxs = $txs->where('status', BannerPaymentTransaction::COMPLETED);
        $completed = (float) $completedTxs->sum(fn ($t) => (float) $t->amount);
        $pending = (float) $txs->where('status', BannerPaymentTransaction::PENDING)->sum(fn ($t) => (float) $t->amount);

        $meta = $payment->meta ?? [];
        $payment->received = Amount::format($completed);
        $expected = (float) $payment->amount;

        if ($payment->status === BannerPaymentStatus::Paid) {
            // Money after the payment was complete: just record the extra
            $meta['overpaid'] = $completed > $expected + self::EPSILON ? Amount::format($completed - $expected) : null;
            $payment->meta = $meta;
            $payment->save();
            return;
        }

        $tolerance = max(0.0, (float) config('banners.payments.underpay_tolerance_percent', 0.5)) / 100;
        $deadline = $payment->expires_at?->copy()->addMinutes((int) config('banners.payments.late_grace_minutes', 15));
        $late = $deadline && $completedTxs->contains(fn ($t) => $t->first_seen_at->gt($deadline));
        $policy = (string) config('banners.payments.late_policy', 'requote');

        $covers = false;
        $review = null;
        if ($completed > 0) {
            if (!$late || self::isPegged($payment->coin) || $policy === 'accept') {
                $covers = $completed + self::EPSILON >= $expected * (1 - $tolerance);
            } elseif ($policy === 'review') {
                $review = 'late';
            } else {
                $rate = $this->provider->usdRate($payment->currency);
                if ($rate !== null) {
                    $value = $completed * $rate;
                    $meta['late_value_usd'] = round($value, 2);
                    $covers = $value + self::EPSILON >= (float) $payment->amount_usd * (1 - $tolerance);
                    $review = $covers ? null : 'late_short';
                }
                // no rate right now: stay open, the scheduled sync evaluates again
            }
        }

        if ($covers) {
            $payment->status = BannerPaymentStatus::Paid;
            $payment->paid_at = now();
            $meta['overpaid'] = $completed > $expected + self::EPSILON ? Amount::format($completed - $expected) : null;
            $meta['review_reason'] = null;
            $payment->meta = $meta;
            $payment->save();

            $reference = (string) $completedTxs->last()->provider_id;
            $order = $payment->order()->first();
            if (!$this->orders->markPaid($order, $this->provider->name(), $reference)) {
                // Paid manually, or with another coin, before this arrived
                $meta['order_already_paid'] = true;
                $payment->meta = $meta;
                $payment->save();
                Log::channel('payments')->warning('Payment completed for an order that was already paid', ['order' => $order->id, 'payment' => $payment->id]);
            }
            return;
        }

        if ($review) {
            $payment->status = BannerPaymentStatus::Review;
            $meta['review_reason'] = $review;
        } elseif ($pending > 0 || ($completed > 0 && $late)) {
            $payment->status = BannerPaymentStatus::Confirming;
        } elseif ($completed > 0) {
            $payment->status = BannerPaymentStatus::Underpaid;
        } else {
            $payment->status = BannerPaymentStatus::Awaiting; // e.g. the only transaction failed
        }
        $payment->meta = $meta;
        $payment->save();
    }

    /** Our payment for a transaction: same label, address, tag and currency. */
    private function match(IncomingTransaction $tx): ?BannerPayment
    {
        $query = BannerPayment::where('provider', $this->provider->name());
        $tx->label !== null && $tx->label !== ''
            ? $query->where('label', $tx->label)
            : $query->where('address', $tx->address);

        foreach ($query->get() as $payment) {
            $tickers = $payment->meta['aliases'] ?? [$payment->currency];
            if (!in_array($tx->currency, $tickers, true)) {
                continue;
            }
            if (!self::sameAddress($payment->address, $tx->address)) {
                continue;
            }
            if ($payment->dest_tag !== null && (string) $payment->dest_tag !== (string) $tx->destTag) {
                continue;
            }
            return $payment;
        }

        return null;
    }

    private static function sameAddress(string $ours, string $theirs): bool
    {
        // EVM addresses are case-insensitive (checksum casing); everything else is exact
        if (str_starts_with($ours, '0x') || str_starts_with($ours, '0X')) {
            return strcasecmp($ours, $theirs) === 0;
        }
        return $ours === $theirs;
    }

    /**
     * @return array{amount_usd: string, rate: string, amount: string, quoted_at: \Illuminate\Support\Carbon, expires_at: \Illuminate\Support\Carbon}
     * @throws PaymentException
     */
    private function quote(BannerOrder $order, array $method): array
    {
        $usd = (float) $order->amount;
        $rate = self::isPegged($method['coin']) ? 1.0 : $this->provider->usdRate($method['ticker']);
        if (!$rate || $rate <= 0) {
            throw new PaymentException('The exchange rate for this coin is unavailable right now. Please try again or choose another coin.', 503, 'no_rate');
        }

        return [
            'amount_usd' => number_format($usd, 2, '.', ''),
            'rate' => Amount::format($rate, 10),
            'amount' => Amount::format(Amount::ceil($usd / $rate, (int) $method['decimals']), (int) $method['decimals']),
            'quoted_at' => now(),
            'expires_at' => now()->addMinutes((int) config('banners.payments.price_lock_minutes', 30)),
        ];
    }

    private function currencyInfo(string $ticker): ?CurrencyInfo
    {
        try {
            return $this->provider->currencies()[strtoupper($ticker)] ?? null;
        } catch (PaymentProviderException $e) {
            Log::channel('payments')->error('Currencies unavailable', ['error' => $e->getMessage()]);
            throw new PaymentException('Crypto payments are temporarily unavailable. Please try again in a minute.', 503, 'unavailable');
        }
    }

    /** Every ticker the gateway may report for this method's currency. */
    private function aliases(array $method, CurrencyInfo $info): array
    {
        return array_values(array_unique(array_map('strtoupper', array_merge([$method['ticker']], $method['aliases'] ?? [], $info->tickers))));
    }

    /** What the frontend needs to draw a method (stored with the payment, so config edits don't change old ones). */
    private static function display(array $m): array
    {
        return [
            'key' => $m['key'],
            'coin' => $m['coin'],
            'coin_name' => $m['coin_name'],
            'network' => $m['network'],
            'network_name' => $m['network_name'],
            'icon' => strtolower($m['coin']),
            'network_icon' => $m['network_icon'] ?? null,
            'decimals' => (int) $m['decimals'],
        ];
    }
}
