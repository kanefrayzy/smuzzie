<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\BannerTemplateStatus;
use App\Http\Controllers\Controller;
use App\Jobs\ProcessBannerTemplate;
use App\Models\BannerTemplate;
use App\Services\Banners\BannerConfigValidator;
use App\Services\Banners\BannerMedia;
use App\Services\Banners\BannerOrderPresenter;
use App\Services\Banners\BannerOrderService;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Admin CRUD for banner templates, video upload and preview rebuilds.
 * Video processing runs on the "banners" queue (ProcessBannerTemplate).
 */
class BannerTemplateController extends Controller
{
    public function __construct(private BannerConfigValidator $configValidator)
    {
    }

    public function index()
    {
        $templates = BannerTemplate::withCount(['orders' => fn ($q) => $q->where('is_test', false)])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (BannerTemplate $t) => $this->present($t));

        return response()->json($templates);
    }

    public function show(BannerTemplate $bannerTemplate)
    {
        $bannerTemplate->loadCount(['orders' => fn ($q) => $q->where('is_test', false)]);

        return response()->json($this->present($bannerTemplate));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), $this->rules(null));
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $data = $this->normalize($validator->validated(), null);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
        $data['is_active'] = false; // no video yet
        $data['processing_status'] = BannerTemplateStatus::None;

        $template = BannerTemplate::create($data);

        return response()->json($this->present($template->fresh()), 201);
    }

    public function update(Request $request, BannerTemplate $bannerTemplate)
    {
        $validator = Validator::make($request->all(), $this->rules($bannerTemplate));
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $data = $this->normalize($validator->validated(), $bannerTemplate);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }

        $zones = $data['config']['zones'] ?? $bannerTemplate->config['zones'] ?? [];
        if (($data['is_active'] ?? $bannerTemplate->is_active) && (!$bannerTemplate->hasMedia() || !$zones)) {
            return response()->json(['errors' => [
                'is_active' => ['Upload and process the video or image and add at least one zone before publishing'],
            ]], 422);
        }

        $watermarkChanged = isset($data['watermark']) && $data['watermark'] != $bannerTemplate->watermark;
        $bannerTemplate->update($data);

        // The watermark is burned into the preview video, so a new one has to be built
        if ($watermarkChanged && $bannerTemplate->source_path && !$bannerTemplate->upload_path) {
            $bannerTemplate->update(['processing_status' => BannerTemplateStatus::Pending]);
            ProcessBannerTemplate::dispatch($bannerTemplate->id);
        }

        return $this->show($bannerTemplate->fresh());
    }

    public function destroy(BannerTemplate $bannerTemplate)
    {
        // Free the slug for a new template; orders keep their snapshot and files
        $bannerTemplate->update([
            'is_active' => false,
            'slug' => Str::limit($bannerTemplate->slug, 200, '') . '--deleted-' . $bannerTemplate->id,
        ]);
        $bannerTemplate->delete();

        return response()->json(['message' => 'Template deleted']);
    }

    /**
     * The template background: a video (MP4/MOV) or, for a static template, an image
     * (PNG/JPG/WebP). What was uploaded decides the template's kind once processing succeeds.
     * The field is `file`; `video` is still accepted.
     */
    public function uploadSource(Request $request, BannerTemplate $bannerTemplate)
    {
        $limits = config('banners.template');
        $file = $request->file('file') ?? $request->file('video');
        $maxKb = (int) $limits['max_upload_mb'] * 1024;
        $imageMimes = implode(',', $limits['image_mimes']);
        $validator = Validator::make(['file' => $file], [
            'file' => "required|file|max:{$maxKb}|mimetypes:video/mp4,video/quicktime,{$imageMimes}|extensions:mp4,mov,m4v,png,jpg,jpeg,webp",
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $mime = $file->getMimeType();
        $isImage = in_array($mime, $limits['image_mimes'], true);
        if ($isImage && $file->getSize() > (int) $limits['max_image_upload_mb'] * 1024 * 1024) {
            return response()->json(['errors' => ['file' => ["Images up to {$limits['max_image_upload_mb']} MB"]]], 422);
        }

        $rev = $bannerTemplate->source_rev + 1;
        $ext = match (true) {
            $mime === 'image/png' => 'png',
            $mime === 'image/jpeg' => 'jpg',
            $mime === 'image/webp' => 'webp',
            strtolower($file->getClientOriginalExtension()) === 'mov' => 'mov',
            default => 'mp4',
        };
        $path = $file->storeAs(
            "templates/{$bannerTemplate->uuid}",
            "upload-{$rev}-" . Str::lower(Str::random(6)) . ".{$ext}",
            config('banners.disks.private')
        );
        if (!$path) {
            return response()->json(['error' => 'Could not store the upload'], 500);
        }

        // An upload that was still waiting is superseded by this one
        $previous = $bannerTemplate->upload_path;
        $bannerTemplate->update([
            'upload_path' => $path,
            'processing_status' => BannerTemplateStatus::Pending,
            'processing_error' => null,
        ]);
        if ($previous && $previous !== $path) {
            Storage::disk(config('banners.disks.private'))->delete($previous);
        }

        ProcessBannerTemplate::dispatch($bannerTemplate->id, $path, $rev);

        return response()->json($this->present($bannerTemplate->fresh()), 202);
    }

    public function reprocess(BannerTemplate $bannerTemplate)
    {
        if (!$bannerTemplate->source_path) {
            return response()->json(['error' => 'Upload a video or an image first'], 422);
        }
        if ($bannerTemplate->upload_path) {
            return response()->json(['error' => 'A new upload is being processed already'], 409);
        }

        $bannerTemplate->update(['processing_status' => BannerTemplateStatus::Pending, 'processing_error' => null]);
        ProcessBannerTemplate::dispatch($bannerTemplate->id);

        return response()->json($this->present($bannerTemplate->fresh()), 202);
    }

    /**
     * "Test render": a hidden test order with the default texts and a sample logo, queued right
     * away. Shown on the template page; never emailed; removed by the cleanup after 7 days.
     */
    public function testRender(Request $request, BannerTemplate $bannerTemplate, BannerOrderService $orders)
    {
        if (!$bannerTemplate->hasMedia()) {
            return response()->json(['error' => 'Upload and process the video or image first'], 422);
        }
        if (!($bannerTemplate->config['zones'] ?? [])) {
            return response()->json(['error' => 'Add at least one zone first'], 422);
        }

        $files = [];
        $tmp = null;
        foreach ($bannerTemplate->config['zones'] as $zone) {
            if ($zone['type'] === 'image' && ($zone['controls']['upload']['enabled'] ?? false)) {
                $tmp ??= $this->sampleLogo();
                $files[$zone['key']] = new UploadedFile($tmp, 'sample-logo.png', 'image/png', null, true);
            }
        }

        try {
            $order = $orders->create($bannerTemplate, null, ['zones' => []], $files, $request->ip(), true);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        } finally {
            if ($tmp) {
                @unlink($tmp);
            }
        }

        return response()->json(BannerOrderPresenter::admin($order, true), 201);
    }

    /** The latest test render of the template, if any. */
    public function latestTestRender(BannerTemplate $bannerTemplate)
    {
        $order = $bannerTemplate->orders()->where('is_test', true)->latest('id')->first();

        return response()->json($order ? BannerOrderPresenter::admin($order, true) : null);
    }

    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|max:500',
            'items.*.id' => 'required|integer|exists:banner_templates,id',
            'items.*.sort_order' => 'required|integer|min:0|max:100000',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($request) {
            foreach ($request->input('items') as $item) {
                BannerTemplate::whereKey($item['id'])->update(['sort_order' => $item['sort_order']]);
            }
        });

        return response()->json(['message' => 'Order updated']);
    }

    // ─── Helpers ───────────────────────────────────────────────

    private function rules(?BannerTemplate $template): array
    {
        $required = $template ? 'sometimes|required' : 'required';

        return [
            'name' => "{$required}|string|max:120",
            'slug' => [
                $template ? 'sometimes' : 'nullable',
                'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::notIn(['order']), // /banners/order/<token> is the order status page
                Rule::unique('banner_templates', 'slug')->ignore($template?->id),
            ],
            'description' => 'nullable|string|max:2000',
            'price' => 'sometimes|numeric|min:0|max:100000',
            'currency' => 'sometimes|string|size:3|regex:/^[A-Z]{3}$/',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0|max:100000',
            'config' => 'sometimes|array',
            'outputs' => 'sometimes|array',
            'watermark' => 'sometimes|array',
        ];
    }

    /** @throws ValidationException */
    private function normalize(array $data, ?BannerTemplate $template): array
    {
        if (isset($data['name'])) {
            $data['name'] = strip_tags($data['name']);
        }
        if (array_key_exists('description', $data) && $data['description'] !== null) {
            $data['description'] = strip_tags($data['description']);
        }
        if (!$template && empty($data['slug'])) {
            $data['slug'] = $this->uniqueSlug($data['name']);
        }

        if (array_key_exists('config', $data) || !$template) {
            $data['config'] = $this->configValidator->validate($data['config'] ?? []);
        }
        if (array_key_exists('outputs', $data) || !$template) {
            $data['outputs'] = $this->configValidator->validateOutputs($data['outputs'] ?? [], $template?->width, $template?->kind ?? BannerMedia::VIDEO);
        }
        if (array_key_exists('watermark', $data) || !$template) {
            $data['watermark'] = $this->configValidator->validateWatermark($data['watermark'] ?? []);
        }

        return $data;
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'banner';
        $slug = $base;
        for ($i = 2; $slug === 'order' || BannerTemplate::withTrashed()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }
        return $slug;
    }

    /** A neutral "LOGO" mark (transparent PNG) for test renders. */
    private function sampleLogo(): string
    {
        $img = imagecreatetruecolor(480, 120);
        imagesavealpha($img, true);
        imagealphablending($img, false);
        imagefill($img, 0, 0, imagecolorallocatealpha($img, 0, 0, 0, 127));
        imagealphablending($img, true);
        $white = imagecolorallocate($img, 255, 255, 255);
        imagefilledellipse($img, 60, 60, 88, 88, $white);
        imagefilledellipse($img, 60, 60, 40, 40, imagecolorallocate($img, 17, 17, 17));
        imagettftext($img, 48, 0, 124, 84, $white, resource_path('fonts/DejaVuSans-Bold.ttf'), 'LOGO');

        $file = tempnam(sys_get_temp_dir(), 'bnsample');
        imagepng($img, $file);
        imagedestroy($img);

        return $file;
    }

    private function present(BannerTemplate $template): array
    {
        return $template->toArray() + [
            'has_media' => $template->hasMedia(),
            'formats' => $template->formats(),
            'is_processing' => in_array($template->processing_status, [BannerTemplateStatus::Pending, BannerTemplateStatus::Processing], true),
            // Ceilings for the admin form (Max texts / Max images of the buyer's own layers)
            'limits' => [
                'custom_max_text' => (int) config('banners.custom.max_text'),
                'custom_max_images' => (int) config('banners.custom.max_images'),
            ],
        ];
    }
}
