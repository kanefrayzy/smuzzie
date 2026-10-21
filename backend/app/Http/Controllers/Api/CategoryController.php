<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\LocalStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        if ($this->isAdminRequest($request)) {
            $query = Category::withCount('portfolioItems');
        } else {
            // Public: hide inactive categories and don't count hidden items
            $query = Category::withCount(['portfolioItems' => fn ($q) => $q->where('is_active', true)]);
        }

        if ($request->has('active_only') || !$this->isAdminRequest($request)) {
            $query->where('is_active', true);
        }

        $categories = $query->orderBy('sort_order')->get();

        return response()->json($categories);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:categories',
            'icon' => 'nullable|string',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();
        if (empty($data['slug'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        $category = Category::create($data);

        return response()->json($category, 201);
    }

    public function show(Request $request, Category $category)
    {
        if (!$category->is_active && !$this->isAdminRequest($request)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $category->loadCount('portfolioItems');
        return response()->json($category);
    }

    public function update(Request $request, Category $category)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255|unique:categories,slug,' . $category->id,
            'icon' => 'nullable|string',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $category->update($validator->validated());

        return response()->json($category);
    }

    public function destroy(Category $category, LocalStorageService $storage)
    {
        // Items are removed by the DB cascade, but their files would stay on disk
        $category->portfolioItems()->whereNotNull('local_path')->pluck('local_path')
            ->each(fn ($path) => $storage->delete($path));

        $category->delete();
        return response()->json(['message' => 'Category deleted successfully']);
    }
}
