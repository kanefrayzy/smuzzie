<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\BannerTemplateStatus;
use App\Http\Controllers\Controller;
use App\Jobs\ProcessBannerTemplate;
use App\Models\BannerTemplate;
use App\Services\Banners\BannerConfigValidator;
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
                'is_active' => ['Upload and process the video and add at least one zone before publishing'],
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

    public function uploadSource(Request $request, BannerTemplate $bannerTemplate)
    {
        $maxKb = (int) config('banners.template.max_upload_mb', 500) * 1024;
        $validator = Validator::make($request->all(), [
            'video' => "required|file|max:{$maxKb}|mimetypes:video/mp4,video/quicktime|extensions:mp4,mov,m4v",
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $file = $request->file('video');
        $rev = $bannerTemplate->source_rev + 1;
        $ext = strtolower($file->getClientOriginalExtension()) === 'mov' ? 'mov' : 'mp4';
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
            return response()->json(['error' => 'Upload a video first'], 422);
        }
        if ($bannerTemplate->upload_path) {
            return response()->json(['error' => 'A new video is being processed already'], 409);
        }

        $bannerTemplate->update(['processing_status' => BannerTemplateStatus::Pending, 'processing_error' => null]);
        ProcessBannerTemplate::dispatch($bannerTemplate->id);

        return response()->json($this->present($bannerTemplate->fresh()), 202);
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
            $data['outputs'] = $this->configValidator->validateOutputs($data['outputs'] ?? [], $template?->width);
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
        for ($i = 2; BannerTemplate::withTrashed()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }
        return $slug;
    }

    private function present(BannerTemplate $template): array
    {
        return $template->toArray() + [
            'has_media' => $template->hasMedia(),
            'is_processing' => in_array($template->processing_status, [BannerTemplateStatus::Pending, BannerTemplateStatus::Processing], true),
        ];
    }
}
