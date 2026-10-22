<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BannerFont;
use App\Models\BannerTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Banner font library. One row = one woff2 face. Files are immutable and stay on disk after
 * deletion (orders that used the font keep rendering); a face used by a template can't be deleted.
 */
class BannerFontController extends Controller
{
    public function index()
    {
        $usage = $this->usageByFont();

        $fonts = BannerFont::orderBy('name')->orderBy('weight')->get()
            ->map(fn (BannerFont $font) => $font->toArray() + ['templates' => $usage[$font->id] ?? []]);

        return response()->json($fonts);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:80',
            'weight' => 'required|integer|between:100,900',
            'style' => 'required|in:normal,italic',
            'file' => 'required|file|max:' . (int) config('banners.fonts.max_kb', 2048),
        ]);
        $validator->after(function ($validator) use ($request) {
            $file = $request->file('file');
            if ($file && !$this->isWoff2($file->getRealPath())) {
                $validator->errors()->add('file', 'Upload a .woff2 font file');
            }
        });
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $uuid = (string) Str::uuid();
        $path = $request->file('file')->storeAs('banners/fonts', "{$uuid}.woff2", config('banners.disks.public'));
        if (!$path) {
            return response()->json(['error' => 'Could not store the font file'], 500);
        }

        $font = new BannerFont([
            'name' => strip_tags($request->input('name')),
            'weight' => (int) $request->input('weight'),
            'style' => $request->input('style'),
            'path' => $path,
            'file_size' => $request->file('file')->getSize(),
        ]);
        $font->uuid = $uuid; // same as the file name
        $font->save();

        return response()->json($font->fresh(), 201);
    }

    public function update(Request $request, BannerFont $bannerFont)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:80',
            'weight' => 'sometimes|required|integer|between:100,900',
            'style' => 'sometimes|required|in:normal,italic',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();
        if (isset($data['name'])) {
            $data['name'] = strip_tags($data['name']);
        }
        $bannerFont->update($data);

        return response()->json($bannerFont->fresh());
    }

    public function destroy(BannerFont $bannerFont)
    {
        $templates = $this->usageByFont()[$bannerFont->id] ?? [];
        if ($templates) {
            return response()->json([
                'error' => 'The font is used by templates. Pick another font there first.',
                'templates' => $templates,
            ], 409);
        }

        // Soft delete: hidden from the pickers, the file stays for orders that used it
        $bannerFont->delete();

        return response()->json(['message' => 'Font deleted']);
    }

    /** @return array<int, array<int, array{id: int, name: string}>> font id => templates using it */
    private function usageByFont(): array
    {
        $usage = [];
        foreach (BannerTemplate::get(['id', 'name', 'config']) as $template) {
            foreach ($template->fontIds() as $fontId) {
                $usage[$fontId][] = ['id' => $template->id, 'name' => $template->name];
            }
        }
        return $usage;
    }

    private function isWoff2(string $file): bool
    {
        $handle = @fopen($file, 'rb');
        if (!$handle) {
            return false;
        }
        $magic = fread($handle, 4);
        fclose($handle);

        return $magic === 'wOF2';
    }
}
