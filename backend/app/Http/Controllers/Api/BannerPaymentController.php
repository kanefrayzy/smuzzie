<?php

namespace App\Http\Controllers\Api;

use App\Enums\BannerOrderStatus;
use App\Http\Controllers\Controller;
use App\Models\BannerOrder;
use App\Services\Payments\BannerPaymentPresenter;
use App\Services\Payments\BannerPaymentService;
use App\Services\Payments\PaymentException;
use Illuminate\Http\Request;

/**
 * Buyer side of the crypto checkout, by the unguessable order token:
 * availability (for the editor's checkout button), the coin picker and the deposit address.
 */
class BannerPaymentController extends Controller
{
    public function __construct(private BannerPaymentService $payments)
    {
    }

    /** Whether the checkout can take money at all; no gateway call. */
    public function availability()
    {
        return response()->json([
            'payments_available' => $this->payments->isAvailable(),
            'auto_approve' => (bool) config('banners.auto_approve'),
            'price_lock_minutes' => (int) config('banners.payments.price_lock_minutes', 30),
        ]);
    }

    public function methods(string $token)
    {
        $order = BannerOrder::where('token', $token)->first();
        if (!$order) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if ($order->status !== BannerOrderStatus::PendingPayment) {
            return response()->json(['available' => false, 'reason' => 'not_pending', 'methods' => []]);
        }

        return response()->json($this->payments->methodsFor($order) + [
            'price_lock_minutes' => (int) config('banners.payments.price_lock_minutes', 30),
        ]);
    }

    public function select(Request $request, string $token)
    {
        $order = BannerOrder::where('token', $token)->first();
        if (!$order) {
            return response()->json(['message' => 'Not found'], 404);
        }
        $request->validate(['method' => 'required|string|max:30']);

        try {
            $payment = $this->payments->select($order, $request->input('method'));
        } catch (PaymentException $e) {
            return response()->json(['error' => $e->getMessage(), 'reason' => $e->reason], $e->status);
        }

        return response()->json(BannerPaymentPresenter::public($payment) + ['server_time' => now()->toIso8601String()]);
    }
}
