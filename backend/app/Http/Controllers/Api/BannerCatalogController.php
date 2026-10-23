<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BannerFont;
use App\Models\BannerTemplate;

/**
 * Public banner catalog: published templates and what the buyer editor needs
 * (zones config, fonts, watermarked preview). Never exposes the private master.
 * `kind` is video (preview_url is an MP4) or image (preview_url is a WebP still).
 */
class BannerCatalogController extends Controller
{
    public function index()
    {
        $templates = BannerTemplate::published()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            // Cards show the template's default texts over the poster, so they carry the layout too
            ->map(fn (BannerTemplate $t) => $this->card($t) + ['config' => $t->config, 'fonts' => $this->fonts($t)]);

        return response()->json($templates);
    }

    public function show(string $slug)
    {
        $template = BannerTemplate::published()->where('slug', $slug)->first();
        if (!$template) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json($this->card($template) + [
            'config' => $template->config,
            'fonts' => $this->fonts($template),
            'fps' => $template->fps,
            'frame_count' => $template->frame_count,
        ]);
    }

    /** Font faces the template uses; deleted ones still render (the file is kept) */
    private function fonts(BannerTemplate $t): array
    {
        return BannerFont::withTrashed()->whereIn('id', $t->fontIds())->get()
            ->map(fn (BannerFont $f) => [
                'id' => $f->id,
                'family' => $f->family,
                'name' => $f->name,
                'weight' => $f->weight,
                'style' => $f->style,
                'url' => $f->url,
            ])->values()->all();
    }

    private function card(BannerTemplate $t): array
    {
        return [
            'slug' => $t->slug,
            'name' => $t->name,
            'description' => $t->description,
            'price' => $t->price,
            'currency' => $t->currency,
            'kind' => $t->kind,
            'width' => $t->width,
            'height' => $t->height,
            'duration' => $t->duration, // null for image templates
            'preview_url' => $t->preview_url,
            'poster_url' => $t->poster_url,
            'outputs' => $t->outputs,
            'formats' => $t->formats(),
        ];
    }
}
