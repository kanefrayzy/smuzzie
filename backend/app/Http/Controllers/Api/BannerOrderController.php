<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use App\Services\Banners\BannerMedia;
use App\Services\Banners\BannerOrderPresenter;
use App\Services\Banners\BannerOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Public side of banner orders: create (rate limited), status by the unguessable token,
 * and file downloads through temporary signed URLs.
 */
class BannerOrderController extends Controller
{
    public function __construct(private BannerOrderService $orders)
    {
    }

    public function store(Request $request)
    {
        $maxKb = (int) config('banners.logo.max_kb', 2048);
        $validator = Validator::make($request->all(), [
            'template' => 'required|string|max:120',
            'email' => 'required|string|email:rfc|max:254',
            'params' => 'required|string|max:60000',
            // Template image zones plus image layers the buyer added
            'images' => 'sometimes|array|max:' . ((int) config('banners.template.max_image_zones', 3) + (int) config('banners.custom.max_images', 3)),
            'images.*' => "file|max:{$maxKb}",
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $template = BannerTemplate::published()->where('slug', $request->input('template'))->first();
        if (!$template) {
            return response()->json(['errors' => ['template' => ['This template is not available']]], 422);
        }

        $params = json_decode($request->input('params'), true, 8);
        if (!is_array($params)) {
            return response()->json(['errors' => ['params' => ['Invalid banner settings']]], 422);
        }

        $files = array_filter((array) $request->file('images', []), fn ($f) => $f instanceof \Illuminate\Http\UploadedFile);

        try {
            $order = $this->orders->create(
                $template,
                strtolower(trim($request->input('email'))),
                $params,
                $files,
                $request->ip()
            );
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }

        return response()->json(BannerOrderPresenter::public($order), 201);
    }

    public function show(string $token)
    {
        $order = BannerOrder::where('token', $token)->first();
        if (!$order) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(BannerOrderPresenter::public($order));
    }

    /** Signed route: the signature covers the token and the format, and expires. */
    public function download(string $token, string $format)
    {
        $order = BannerOrder::where('token', $token)->first();
        if (!$order || !in_array($format, $order->resultFormats(), true)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $path = $order->result[$format]['path'];
        $disk = Storage::disk(config('banners.disks.private'));
        if (!$disk->exists($path)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $name = ($order->snapshot['template']['slug'] ?? 'banner') . '-' . substr($order->token, 0, 8) . '.' . $format;

        return $disk->download($path, $name, [
            'Content-Type' => BannerMedia::MIME[$format],
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /** Signed route used by the admin order view to show a buyer's logo. */
    public function image(string $token, string $key)
    {
        $order = BannerOrder::where('token', $token)->first();
        $path = $order?->images[$key] ?? null;
        $disk = Storage::disk(config('banners.disks.private'));
        if (!$path || !$disk->exists($path)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return $disk->response($path, null, ['Content-Type' => 'image/png', 'Cache-Control' => 'private, max-age=600']);
    }
}
