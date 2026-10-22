<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Payments\BannerPaymentService;
use App\Services\Payments\PaymentProviderException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Payment notifications (IPN). Outside auth; API routes have no CSRF.
 *
 * The body is never trusted: only the transaction id is taken from it, the transaction is then
 * fetched from the gateway's API and checked against our payment (label, address, tag,
 * currency, amount, status) in BannerPaymentService.
 */
class PaymentWebhookController extends Controller
{
    public function __construct(private BannerPaymentService $payments)
    {
    }

    public function westwallet(Request $request)
    {
        $provider = $this->payments->provider();
        $log = Log::channel('payments');
        $context = [
            'ip' => $request->ip(),
            // the documented IPN fields; nothing secret in them
            'body' => $request->only(['id', 'label', 'currency', 'amount', 'status', 'address', 'dest_tag', 'blockchain_confirmations', 'blockchain_hash']),
        ];

        if ($provider->name() !== 'westwallet' || !$provider->isConfigured()) {
            $log->warning('IPN while WestWallet is not the configured provider', $context);
            return response('not configured', 503);
        }
        if (!$provider->isTrustedCallback($request)) {
            $log->warning('IPN rejected: untrusted source', $context);
            return response('forbidden', 403);
        }

        $id = $provider->callbackTransactionId($request);
        if ($id === null) {
            $log->warning('IPN without a transaction id', $context);
            return response('bad request', 400);
        }

        try {
            $outcome = $this->payments->handleCallback($id);
        } catch (PaymentProviderException $e) {
            // Could not verify now; WestWallet may retry and the scheduled sync re-checks open payments
            $log->error('IPN verification failed', $context + ['error' => $e->getMessage()]);
            return response('retry later', 503);
        }

        $log->info('IPN processed', $context + ['outcome' => $outcome]);

        return response('ok', 200);
    }
}
