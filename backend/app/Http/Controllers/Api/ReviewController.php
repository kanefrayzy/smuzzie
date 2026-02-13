<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ReviewController extends Controller
{
    public function index(Request $request)
    {
        $query = Review::query();

        if (!$request->has('include_inactive')) {
            $query->active();
        }

        $perPage = min((int) $request->get('per_page', 50), 100);
        $reviews = $query->orderBy('sort_order')->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($reviews);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'customer_name' => 'required|string|max:255',
            'customer_avatar' => 'nullable|url|max:500',
            'content' => 'required|string|max:2000',
            'rating' => 'required|integer|min:1|max:5',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();
        $validated['customer_name'] = strip_tags($validated['customer_name']);
        if (!empty($validated['content'])) {
            $validated['content'] = strip_tags($validated['content']);
        }

        $review = Review::create($validated);

        return response()->json($review, 201);
    }

    public function update(Request $request, Review $review)
    {
        $validator = Validator::make($request->all(), [
            'customer_name' => 'sometimes|string|max:255',
            'customer_avatar' => 'nullable|url|max:500',
            'content' => 'sometimes|string|max:2000',
            'rating' => 'sometimes|integer|min:1|max:5',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $review->update($validator->validated());

        return response()->json($review);
    }

    public function destroy(Review $review)
    {
        $review->delete();
        return response()->json(['message' => 'Review deleted successfully']);
    }
}
