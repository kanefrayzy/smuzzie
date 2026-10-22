<?php

namespace App\Services\Banners;

use App\Models\BannerFont;
use App\Models\BannerTemplate;

/**
 * Full template snapshot stored with an order. The renderer reads only this, so later edits,
 * a new video or deleted fonts never change an existing order. Files referenced here are
 * immutable (new uploads get new names).
 */
class BannerSnapshot
{
    public static function fromTemplate(BannerTemplate $template): array
    {
        $fonts = BannerFont::withTrashed()->whereIn('id', $template->fontIds())->get()
            ->map(fn (BannerFont $f) => [
                'id' => $f->id,
                'name' => $f->name,
                'family' => $f->family,
                'weight' => $f->weight,
                'style' => $f->style,
                'path' => $f->path,
            ])->values()->all();

        return [
            'snapshotVersion' => (int) config('banners.snapshot_version', 1),
            'template' => [
                'id' => $template->id,
                'uuid' => $template->uuid,
                'slug' => $template->slug,
                'name' => $template->name,
                'price' => (string) $template->price,
                'currency' => $template->currency,
            ],
            // video (MP4/GIF results) or image (PNG/JPG); older snapshots without it are videos
            'kind' => $template->kind ?? BannerMedia::VIDEO,
            'config' => $template->config,
            'outputs' => $template->outputs,
            'watermark' => $template->watermark,
            'media' => [
                'width' => $template->width,
                'height' => $template->height,
                'fps' => $template->fps,
                'duration' => $template->duration,
                'frame_count' => $template->frame_count,
                'source_rev' => $template->source_rev,
                'source_path' => $template->source_path,
            ],
            'fonts' => $fonts,
        ];
    }
}
