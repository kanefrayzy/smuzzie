<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\BannerOrderStatus;
use App\Http\Controllers\Controller;
use App\Models\BannerOrder;
use App\Services\Banners\BannerOrderPresenter;
use App\Services\Banners\BannerOrderService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Admin view of banner orders: list, details, manual payment confirmation, re-render. */
class BannerOrderController extends Controller
{
    public function __construct(private BannerOrderService $orders)
    {
    }

    public function index(Request $request)
    {
        $request->validate([
            'status' => ['nullable', Rule::in(BannerOrderStatus::values())],
            'include_tests' => 'nullable|boolean',
            'search' => 'nullable|string|max:120',
        ]);

        $query = BannerOrder::query()->orderByDesc('id');
        if (!$request->boolean('include_tests')) {
            $query->real();
        }
        if ($request->filled('status')) {
            $query->status($request->input('status'));
        }
        if ($request->filled('search')) {
            $term = trim($request->input('search'));
            $query->where(fn ($q) => $q->where('email', 'like', '%' . addcslashes($term, '%_\\') . '%')
                ->orWhere('token', 'like', addcslashes($term, '%_\\') . '%'));
        }

        $page = $query->paginate(30);
        $page->getCollection()->transform(fn (BannerOrder $o) => BannerOrderPresenter::admin($o));

        $counts = BannerOrder::query()
            ->when(!$request->boolean('include_tests'), fn ($q) => $q->real())
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json(['orders' => $page, 'counts' => $counts]);
    }

    public function show(BannerOrder $bannerOrder)
    {
        return response()->json(BannerOrderPresenter::admin($bannerOrder, true));
    }

    public function markPaid(Request $request, BannerOrder $bannerOrder)
    {
        if (!$this->orders->markPaid($bannerOrder, 'manual', 'admin:' . $request->user()->id)) {
            return response()->json(['error' => 'The order is not waiting for payment'], 409);
        }

        return response()->json(BannerOrderPresenter::admin($bannerOrder->fresh(), true));
    }

    public function rerender(BannerOrder $bannerOrder)
    {
        if (!$this->orders->rerender($bannerOrder)) {
            return response()->json(['error' => 'Only ready or failed orders can be rendered again'], 409);
        }

        return response()->json(BannerOrderPresenter::admin($bannerOrder->fresh(), true));
    }
}
