<?php

/*
|--------------------------------------------------------------------------
| Video banner builder
|--------------------------------------------------------------------------
| Templates (AE video without text + JSON zones), buyer orders and the render
| pipeline. See docs/banners/PLAN.md for the full picture.
*/

return [

    // Skip the payment step: new orders go straight to the render queue. Development only.
    'auto_approve' => (bool) env('BANNERS_AUTO_APPROVE', false),

    // Public origin of the Next.js site, used for links in emails.
    'frontend_url' => rtrim((string) env('BANNERS_FRONTEND_URL', env('APP_URL', 'http://localhost:3000')), '/'),

    'disks' => [
        'private' => 'banners', // sources, buyer logos, results
        'public' => 'public',   // watermarked previews, posters, fonts
    ],

    'queue' => [
        'connection' => 'banners',
        'name' => 'banners',
    ],

    // Bump when the format of banner_templates.config changes; old snapshots keep their own version.
    'schema_version' => 1,
    'snapshot_version' => 1,

    'template' => [
        'max_upload_mb' => 500,
        'max_duration' => 60,      // seconds
        'max_side' => 4096,        // px
        'max_fps' => 60,
        'max_zones' => 20,
        'max_image_zones' => 3,
        'preview_width' => 720,
        'preview_crf' => 26,
        'master_crf' => 15,        // only when the upload can't be used as-is (not H.264 yuv420p / odd size)
        'default_watermark' => [
            'text' => 'SMUZZIE  PREVIEW',
            'opacity' => 20,       // 0-255; the prototype used 46, which was too strong
        ],
        'default_outputs' => [
            'mp4' => true,
            'gif' => ['enabled' => false, 'width' => 600, 'fps' => 15],
        ],
    ],

    'fonts' => [
        'max_kb' => 2048,
    ],

    'logo' => [
        'max_kb' => 2048,
        'max_side' => 4096,
        'max_pixels' => 16_000_000,
        'mimes' => ['image/png', 'image/jpeg', 'image/webp'],
    ],

    'text' => [
        'max_length' => 200, // hard cap regardless of what a template allows
    ],

    'render' => [
        'node_binary' => env('BANNERS_NODE_BINARY', 'node'),
        'ffmpeg_binary' => env('BANNERS_FFMPEG_BINARY', 'ffmpeg'),
        'ffprobe_binary' => env('BANNERS_FFPROBE_BINARY', 'ffprobe'),
        'script' => base_path('../renderer/src/render.mjs'),
        'timeout' => 540,          // seconds for one renderer run; the job timeout is above this
        'job_timeout' => 600,
        'tries' => 2,
        'threads' => (int) env('BANNERS_FFMPEG_THREADS', 3),
        'chromium_sandbox' => (bool) env('BANNERS_CHROMIUM_SANDBOX', true),
        'browsers_path' => env('PLAYWRIGHT_BROWSERS_PATH'),
    ],

    'retention' => [
        'unpaid_days' => 7,
        'test_days' => 7,
        'result_days' => (int) env('BANNERS_RESULT_TTL_DAYS', 30),
        'tmp_hours' => 24,
    ],

    'download_link_days' => 7,

    'rate_limits' => [
        'orders_per_minute' => 5,
        'orders_per_day' => 30,
        'status_per_minute' => 60,
    ],
];
