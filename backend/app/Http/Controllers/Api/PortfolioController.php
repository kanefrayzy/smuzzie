<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortfolioItem;
use App\Services\LocalStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PortfolioController extends Controller
{
    protected $storage;

    public function __construct(LocalStorageService $storage)
    {
        $this->storage = $storage;
    }

    public function index(Request $request)
    {
        $query = PortfolioItem::with('category');

        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->has('category_slug')) {
            $query->whereHas('category', function ($q) use ($request) {
                $q->where('slug', $request->category_slug);
            });
        }

        if ($request->has('featured')) {
            $query->featured();
        }

        if ($request->has('active_only') || !$request->has('include_inactive')) {
            $query->active();
        }

        $perPage = $request->get('per_page', 20);
        $items = $query->orderBy('sort_order')->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($items);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'category_id' => 'required|exists:categories,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'image' => 'required|file|mimes:jpeg,png,gif,webp,mp4,webm|max:512000',
            'is_featured' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
            'tags' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $file = $request->file('image');

        // Additional file validation
        $fileErrors = LocalStorageService::validateFile($file);
        if (!empty($fileErrors)) {
            return response()->json(['errors' => ['image' => $fileErrors]], 422);
        }

        $ext = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension());
        $isGif = $ext === 'gif';
        $isVideo = in_array($ext, ['mp4', 'webm']);

        try {
            // Upload to local storage
            $uploadResult = $this->storage->upload($file, 'portfolio');

            // Generate thumbnail
            if ($isVideo) {
                $thumbnailUrl = $this->storage->generateVideoThumbnail($uploadResult['path']);
            } else {
                $thumbnailUrl = $this->storage->generateThumbnail($uploadResult['path'], 400, 300);
            }
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 503);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Image upload failed: ' . $e->getMessage()], 500);
        }

        $data = $validator->validated();
        unset($data['image']);

        // Sanitize text inputs
        $data['title'] = strip_tags($data['title']);
        if (!empty($data['description'])) {
            $data['description'] = strip_tags($data['description']);
        }

        $data['image_url'] = $uploadResult['url'];
        $data['thumbnail_url'] = $thumbnailUrl;
        $data['local_path'] = $uploadResult['path'];
        $data['width'] = $uploadResult['width'];
        $data['height'] = $uploadResult['height'];
        $data['file_type'] = $isVideo ? 'video' : ($isGif ? 'gif' : 'image');
        $data['file_size'] = $uploadResult['size'];

        if ($isGif || $isVideo) {
            $data['gif_url'] = $uploadResult['url'];
        }

        $item = PortfolioItem::create($data);
        $item->load('category');

        return response()->json($item, 201);
    }

    public function show(PortfolioItem $portfolioItem)
    {
        $portfolioItem->load('category');
        return response()->json($portfolioItem);
    }

    public function update(Request $request, PortfolioItem $portfolioItem)
    {
        $validator = Validator::make($request->all(), [
            'category_id' => 'sometimes|exists:categories,id',
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|file|mimes:jpeg,png,gif,webp,mp4,webm|max:512000',
            'is_featured' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
            'tags' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

        // Sanitize text inputs
        if (isset($data['title'])) {
            $data['title'] = strip_tags($data['title']);
        }
        if (!empty($data['description'])) {
            $data['description'] = strip_tags($data['description']);
        }

        if ($request->hasFile('image')) {
            $file = $request->file('image');

            // Additional file validation
            $fileErrors = LocalStorageService::validateFile($file);
            if (!empty($fileErrors)) {
                return response()->json(['errors' => ['image' => $fileErrors]], 422);
            }

            try {
                // Delete old file from local storage
                if ($portfolioItem->local_path) {
                    $this->storage->delete($portfolioItem->local_path);
                }

                $ext = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension());
                $isGif = $ext === 'gif';
                $isVideo = in_array($ext, ['mp4', 'webm']);

                $uploadResult = $this->storage->upload($file, 'portfolio');
                if ($isVideo) {
                    $thumbnailUrl = $this->storage->generateVideoThumbnail($uploadResult['path']);
                } else {
                    $thumbnailUrl = $this->storage->generateThumbnail($uploadResult['path'], 400, 300);
                }

                $data['image_url'] = $uploadResult['url'];
                $data['thumbnail_url'] = $thumbnailUrl;
                $data['local_path'] = $uploadResult['path'];
                $data['width'] = $uploadResult['width'];
                $data['height'] = $uploadResult['height'];
                $data['file_type'] = $isVideo ? 'video' : ($isGif ? 'gif' : 'image');
                $data['file_size'] = $uploadResult['size'];

                if ($isGif || $isVideo) {
                    $data['gif_url'] = $uploadResult['url'];
                }
            } catch (\RuntimeException $e) {
                return response()->json(['error' => $e->getMessage()], 503);
            } catch (\Exception $e) {
                return response()->json(['error' => 'Image upload failed: ' . $e->getMessage()], 500);
            }

            unset($data['image']);
        }

        $portfolioItem->update($data);
        $portfolioItem->load('category');

        return response()->json($portfolioItem);
    }

    public function destroy(PortfolioItem $portfolioItem)
    {
        if ($portfolioItem->local_path) {
            $this->storage->delete($portfolioItem->local_path);
        }

        $portfolioItem->delete();
        return response()->json(['message' => 'Portfolio item deleted successfully']);
    }

    /**
     * Bulk delete multiple portfolio items.
     */
    public function bulkDelete(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:portfolio_items,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $ids = $request->input('ids');
        $items = PortfolioItem::whereIn('id', $ids)->get();
        $count = 0;

        foreach ($items as $item) {
            if ($item->local_path) {
                $this->storage->delete($item->local_path);
            }
            $item->delete();
            $count++;
        }

        return response()->json([
            'message' => "{$count} portfolio items deleted successfully",
            'deleted_count' => $count,
        ]);
    }

    public function toggleField(Request $request, PortfolioItem $portfolioItem)
    {
        $validator = Validator::make($request->all(), [
            'is_featured' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $portfolioItem->update($validator->validated());
        $portfolioItem->load('category');

        return response()->json($portfolioItem);
    }

    public function bulkUpload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'category_id' => 'required|exists:categories,id',
            'images' => 'required|array|min:1|max:100',
            'images.*' => 'file|mimes:jpeg,png,gif,webp,mp4,webm|max:512000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $items = [];
        $files = $request->file('images');
        $errors = [];

        // Validate all files first
        foreach ($files as $index => $file) {
            $fileErrors = LocalStorageService::validateFile($file);
            if (!empty($fileErrors)) {
                $errors["images.{$index}"] = $fileErrors;
            }
        }

        if (!empty($errors)) {
            return response()->json(['errors' => $errors], 422);
        }

        try {
        foreach ($files as $index => $file) {
            $ext = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension());
            $isGif = $ext === 'gif';
            $isVideo = in_array($ext, ['mp4', 'webm']);
            $uploadResult = $this->storage->upload($file, 'portfolio');

            if ($isVideo) {
                $thumbnailUrl = $this->storage->generateVideoThumbnail($uploadResult['path']);
            } else {
                $thumbnailUrl = $this->storage->generateThumbnail($uploadResult['path'], 400, 300);
            }

            $safeTitle = strip_tags(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
            $data = [
                'category_id' => $request->category_id,
                'title' => mb_substr($safeTitle, 0, 255),
                'image_url' => $uploadResult['url'],
                'thumbnail_url' => $thumbnailUrl,
                'local_path' => $uploadResult['path'],
                'width' => $uploadResult['width'],
                'height' => $uploadResult['height'],
                'file_type' => $isVideo ? 'video' : ($isGif ? 'gif' : 'image'),
                'file_size' => $uploadResult['size'],
                'sort_order' => $index,
            ];

            if ($isGif || $isVideo) {
                $data['gif_url'] = $uploadResult['url'];
            }

            $items[] = PortfolioItem::create($data);
        }
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 503);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Image upload failed: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => count($items) . ' items uploaded successfully',
            'items' => $items,
        ], 201);
    }

    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array',
            'items.*.id' => 'required|exists:portfolio_items,id',
            'items.*.sort_order' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        foreach ($request->items as $item) {
            PortfolioItem::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        return response()->json(['message' => 'Items reordered successfully']);
    }
    /**
     * Regenerate video thumbnails via FFmpeg.
     */
    public function regenerateThumbnails(Request $request)
    {
        $force = $request->boolean('force', false);

        $query = PortfolioItem::where('file_type', 'video');

        if (!$force) {
            $query->where(function ($q) {
                $q->whereRaw("thumbnail_url LIKE '%.mp4'")
                  ->orWhereRaw("thumbnail_url LIKE '%.webm'")
                  ->orWhereColumn('thumbnail_url', 'image_url');
            });
        }

        $videos = $query->get();

        if ($videos->isEmpty()) {
            return response()->json(['message' => 'No videos need thumbnail generation.', 'processed' => 0, 'failed' => 0]);
        }

        $success = 0;
        $failed = 0;

        foreach ($videos as $item) {
            if (!$item->local_path) {
                $failed++;
                continue;
            }

            $thumbnailUrl = $this->storage->generateVideoThumbnail($item->local_path);

            if ($thumbnailUrl && !str_ends_with($thumbnailUrl, '.mp4') && !str_ends_with($thumbnailUrl, '.webm')) {
                $item->update(['thumbnail_url' => $thumbnailUrl]);
                $success++;
            } else {
                $failed++;
            }
        }

        return response()->json([
            'message' => "{$success} thumbnails generated" . ($failed > 0 ? ", {$failed} failed" : ''),
            'processed' => $success,
            'failed' => $failed,
        ]);
    }}
