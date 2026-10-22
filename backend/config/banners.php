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
        'max_side' => 4096,        // px, videos and images
        // Static templates: a PNG/JPG/WebP background instead of a video (sRGB or untagged)
        'max_image_upload_mb' => 50,
        'max_image_pixels' => 16_777_216, // 4096x4096
        'image_mimes' => ['image/png', 'image/jpeg', 'image/webp'],
        'max_fps' => 60,
        'max_zones' => 20,
        'max_image_zones' => 12, // logos and icons (PHP max_file_uploads must stay above this + custom.max_images)
        'preview_width' => 720,
        'preview_crf' => 26,
        'master_crf' => 15,        // only when the upload can't be used as-is (not H.264 yuv420p / odd size)
        'default_watermark' => [
            'text' => 'SMUZZIE  PREVIEW',
            'opacity' => 20,       // 0-255; the prototype used 46, which was too strong
        ],
        'default_outputs' => [
            'mp4' => true,
            // GIF width is capped by the template width (and 1080); about 3 MB per second at 1000 px / 15 fps
            'gif' => ['enabled' => false, 'width' => 1000, 'fps' => 15],
        ],
        // Image templates: PNG always, JPG optional (quality 60-100)
        'default_image_outputs' => [
            'png' => true,
            'jpg' => ['enabled' => true, 'quality' => 92],
        ],
    ],

    'fonts' => [
        'max_kb' => 2048,
    ],

    // Layers the buyer adds on top of a template (texts and images), upper limits for any template
    'custom' => [
        'max_text' => 10,
        'max_images' => 3,
    ],

    'logo' => [
        'max_kb' => 2048,
        'max_side' => 4096,
        'max_pixels' => 16_000_000,
        'mimes' => ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        // Animated GIFs (icons, logos) are kept animated: checked from the file structure first,
        // then re-encoded by ffmpeg with a time limit. A one-frame GIF is treated like a PNG.
        'gif' => [
            'max_side' => 1024,
            'max_frames' => 300,
            'max_duration' => 20,             // seconds, as browsers play it
            'max_total_pixels' => 50_000_000, // canvas width x height x frames: bounds decode work
            'timeout' => 30,                  // seconds for the ffmpeg re-encode
        ],
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
        'payment_per_minute' => 10,   // choosing a coin (may create a deposit address)
        'payment_per_day' => 60,
        'ipn_per_minute' => 120,
    ],

    /*
    | Crypto payments. The buyer pays on /banners/order/<token>: picks a coin and network,
    | gets a deposit address (one per order + coin, reused), and the provider's notification
    | (verified against the provider's API) moves the order to "paid" through
    | BannerOrderService::markPaid(). See docs/banners/DEPLOY.md, "Payments (WestWallet)".
    */
    'payments' => [
        'provider' => env('BANNERS_PAYMENT_PROVIDER', 'westwallet'),

        // How long the quoted coin amount is guaranteed. After that the buyer gets a fresh quote
        // for the same address (only while nothing has been received yet).
        'price_lock_minutes' => (int) env('BANNERS_PAYMENT_LOCK_MINUTES', 30),
        // A transaction first seen up to this long after the lock ended still counts as on time
        // (slow wallets, mempool delays).
        'late_grace_minutes' => (int) env('BANNERS_PAYMENT_GRACE_MINUTES', 15),
        // Received amounts this much below the quote still count as paid (rounding, wallet quirks).
        'underpay_tolerance_percent' => (float) env('BANNERS_PAYMENT_UNDERPAY_TOLERANCE', 0.5),
        // A payment that arrives after lock + grace, for coins not pegged to USD:
        //   requote - accept if what arrived is worth the price at the current rate, else "review";
        //   accept  - always honour the original quote;
        //   review  - always leave it to the admin.
        'late_policy' => env('BANNERS_PAYMENT_LATE_POLICY', 'requote'),

        'max_addresses_per_order' => 6,  // different coins one order may try
        'sync_hours' => 24,              // the scheduled sync re-checks open payments this long
        'sync_interval_seconds' => 120,  // ...and each one at most this often
        'rates_cache_seconds' => 60,     // WestWallet allows its rates endpoint once per 5 s
        'currencies_cache_seconds' => 600,

        // Coins priced 1:1 to the USD price (no exchange rate involved)
        'usd_pegged' => ['USDT', 'USDC'],
        // Ticker whose rate is treated as USD for the other coins (coin -> USDT TRC-20)
        'rate_quote_ticker' => 'USDTTRC',

        /*
        | What the picker offers, in this order. Only methods whose ticker WestWallet currently
        | accepts (currencies_data: active + receive_active) are shown. `ticker` is what we send
        | to WestWallet, `aliases` are other codes WestWallet uses for the same currency
        | (merged with currencies_data at runtime). `decimals`: the quote is rounded up to this.
        | Icons live in frontend/public/crypto/ (<coin>.svg); `network_icon` names a file in
        | networks/ and is set only for tokens on another chain (USDT on Tron), null for a chain's own coin.
        */
        'methods' => [
            ['key' => 'usdt-trc20', 'coin' => 'USDT', 'coin_name' => 'Tether', 'network' => 'TRC20', 'network_name' => 'Tron (TRC20)', 'network_icon' => 'tron', 'ticker' => 'USDTTRC', 'aliases' => ['USDTTRC20'], 'decimals' => 2],
            ['key' => 'usdt-erc20', 'coin' => 'USDT', 'coin_name' => 'Tether', 'network' => 'ERC20', 'network_name' => 'Ethereum (ERC20)', 'network_icon' => 'ethereum', 'ticker' => 'USDTERC', 'aliases' => ['USDT', 'USDTERC20'], 'decimals' => 2],
            ['key' => 'usdt-bep20', 'coin' => 'USDT', 'coin_name' => 'Tether', 'network' => 'BEP20', 'network_name' => 'BNB Smart Chain (BEP20)', 'network_icon' => 'bsc', 'ticker' => 'USDTBEP', 'aliases' => ['USDTBEP20'], 'decimals' => 2],
            ['key' => 'usdt-ton', 'coin' => 'USDT', 'coin_name' => 'Tether', 'network' => 'TON', 'network_name' => 'TON', 'network_icon' => 'ton', 'ticker' => 'USDTTON', 'aliases' => ['USDTTONCOIN'], 'decimals' => 2],
            ['key' => 'usdt-sol', 'coin' => 'USDT', 'coin_name' => 'Tether', 'network' => 'SOL', 'network_name' => 'Solana', 'network_icon' => 'solana', 'ticker' => 'USDTSOL', 'aliases' => [], 'decimals' => 2],
            ['key' => 'usdc-erc20', 'coin' => 'USDC', 'coin_name' => 'USD Coin', 'network' => 'ERC20', 'network_name' => 'Ethereum (ERC20)', 'network_icon' => 'ethereum', 'ticker' => 'USDCERC', 'aliases' => ['USDC', 'USDCERC20'], 'decimals' => 2],
            ['key' => 'usdc-bep20', 'coin' => 'USDC', 'coin_name' => 'USD Coin', 'network' => 'BEP20', 'network_name' => 'BNB Smart Chain (BEP20)', 'network_icon' => 'bsc', 'ticker' => 'USDCBEP', 'aliases' => ['USDCBEP20'], 'decimals' => 2],
            ['key' => 'btc', 'coin' => 'BTC', 'coin_name' => 'Bitcoin', 'network' => 'BTC', 'network_name' => 'Bitcoin', 'network_icon' => null, 'ticker' => 'BTC', 'aliases' => [], 'decimals' => 8],
            ['key' => 'eth', 'coin' => 'ETH', 'coin_name' => 'Ethereum', 'network' => 'ERC20', 'network_name' => 'Ethereum', 'network_icon' => null, 'ticker' => 'ETH', 'aliases' => [], 'decimals' => 6],
            ['key' => 'ltc', 'coin' => 'LTC', 'coin_name' => 'Litecoin', 'network' => 'LTC', 'network_name' => 'Litecoin', 'network_icon' => null, 'ticker' => 'LTC', 'aliases' => [], 'decimals' => 6],
            ['key' => 'trx', 'coin' => 'TRX', 'coin_name' => 'Tron', 'network' => 'TRC20', 'network_name' => 'Tron', 'network_icon' => null, 'ticker' => 'TRX', 'aliases' => [], 'decimals' => 2],
            ['key' => 'sol', 'coin' => 'SOL', 'coin_name' => 'Solana', 'network' => 'SOL', 'network_name' => 'Solana', 'network_icon' => null, 'ticker' => 'SOL', 'aliases' => [], 'decimals' => 5],
            ['key' => 'ton', 'coin' => 'TON', 'coin_name' => 'Toncoin', 'network' => 'TON', 'network_name' => 'TON', 'network_icon' => null, 'ticker' => 'TON', 'aliases' => ['GRAM'], 'decimals' => 3],
            ['key' => 'bnb', 'coin' => 'BNB', 'coin_name' => 'BNB', 'network' => 'BEP20', 'network_name' => 'BNB Smart Chain (BEP20)', 'network_icon' => null, 'ticker' => 'BNB', 'aliases' => ['BNBBEP20', 'BNB20'], 'decimals' => 6],
            ['key' => 'xrp', 'coin' => 'XRP', 'coin_name' => 'XRP', 'network' => 'XRP', 'network_name' => 'XRP Ledger', 'network_icon' => null, 'ticker' => 'XRP', 'aliases' => [], 'decimals' => 3],
            ['key' => 'doge', 'coin' => 'DOGE', 'coin_name' => 'Dogecoin', 'network' => 'DOGE', 'network_name' => 'Dogecoin', 'network_icon' => null, 'ticker' => 'DOGE', 'aliases' => [], 'decimals' => 2],
            ['key' => 'bch', 'coin' => 'BCH', 'coin_name' => 'Bitcoin Cash', 'network' => 'BCH', 'network_name' => 'Bitcoin Cash', 'network_icon' => null, 'ticker' => 'BCH', 'aliases' => [], 'decimals' => 6],
            ['key' => 'ada', 'coin' => 'ADA', 'coin_name' => 'Cardano', 'network' => 'ADA', 'network_name' => 'Cardano', 'network_icon' => null, 'ticker' => 'ADA', 'aliases' => [], 'decimals' => 2],
        ],
    ],
];
