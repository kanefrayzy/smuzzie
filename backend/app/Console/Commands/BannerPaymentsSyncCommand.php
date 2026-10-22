<?php

namespace App\Console\Commands;

use App\Enums\BannerOrderStatus;
use App\Enums\BannerPaymentStatus;
use App\Models\BannerPayment;
use App\Services\Payments\BannerPaymentService;
use App\Services\Payments\PaymentProviderException;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Safety net for lost payment notifications (scheduled every minute in App\Console\Kernel):
 * open payments of unpaid orders from the last `sync_hours` are looked up through the
 * gateway's API, each at most every `sync_interval_seconds`. Same code path as the IPN.
 */
class BannerPaymentsSyncCommand extends Command
{
    protected $signature = 'banners:payments-sync {--all : Ignore the per-payment interval}';

    protected $description = 'Re-check open crypto payments of banner orders through the payment gateway API';

    public function handle(BannerPaymentService $payments): int
    {
        if (!$payments->isAvailable()) {
            return self::SUCCESS;
        }
        $cfg = config('banners.payments');
        $query = BannerPayment::query()
            ->whereIn('status', [BannerPaymentStatus::Awaiting->value, BannerPaymentStatus::Confirming->value, BannerPaymentStatus::Underpaid->value])
            ->where('provider', $payments->provider()->name())
            ->where('created_at', '>=', now()->subHours((int) $cfg['sync_hours']))
            ->whereHas('order', fn ($q) => $q->where('status', BannerOrderStatus::PendingPayment->value));
        if (!$this->option('all')) {
            $query->where(fn ($q) => $q->whereNull('last_checked_at')
                ->orWhere('last_checked_at', '<', now()->subSeconds((int) $cfg['sync_interval_seconds'])));
        }

        $n = 0;
        foreach ($query->orderBy('id')->limit(100)->get() as $payment) {
            try {
                $payments->sync($payment);
                $n++;
            } catch (PaymentProviderException $e) {
                Log::channel('payments')->warning('Payment sync failed', ['payment' => $payment->id, 'error' => $e->getMessage()]);
                $payment->forceFill(['last_checked_at' => now()])->save();
                if (in_array($e->errorCode, ['connection', 'wrong_auth', 'wrong_hmac', 'ip_not_allowed'], true)) {
                    break; // the same for every payment; try again next minute
                }
            }
        }
        if ($n) {
            $this->line("checked: {$n}");
        }

        return self::SUCCESS;
    }
}
