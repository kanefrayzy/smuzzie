<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PortfolioItem;
use App\Models\Category;

class DemoPortfolioSeeder extends Seeder
{
    public function run(): void
    {
        // Clear existing demo items
        PortfolioItem::truncate();

        $categories = Category::all()->keyBy('slug');

        $portfolioData = [
            // ─── Logo Design (category 1) ───────────────────
            [
                'category_slug' => 'logo-design',
                'items' => [
                    [
                        'title' => 'Wolf Esports Mascot',
                        'description' => 'Aggressive wolf mascot logo for a competitive esports team. Bold red-black palette with sharp geometric lines.',
                        'image_url' => 'https://placehold.co/800x600/1a1a2e/e63946?text=🐺+Wolf+Esports&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/1a1a2e/e63946?text=🐺+Wolf+Esports&font=montserrat',
                        'is_featured' => true,
                        'tags' => ['esports', 'mascot', 'wolf', 'gaming'],
                    ],
                    [
                        'title' => 'Nexus Tech Logo',
                        'description' => 'Minimalist tech startup logo. Clean monogram with gradient accent, suitable for SaaS products.',
                        'image_url' => 'https://placehold.co/800x600/0d1117/58a6ff?text=N+NEXUS&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/0d1117/58a6ff?text=N+NEXUS&font=montserrat',
                        'is_featured' => true,
                        'tags' => ['minimalist', 'tech', 'startup', 'monogram'],
                    ],
                    [
                        'title' => 'Phoenix Gaming Clan',
                        'description' => 'Fiery phoenix mascot with dynamic wings and bold typography for a competitive gaming clan.',
                        'image_url' => 'https://placehold.co/800x600/1a0a00/ff6b35?text=🔥+PHOENIX&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/1a0a00/ff6b35?text=🔥+PHOENIX&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['phoenix', 'gaming', 'fire', 'clan'],
                    ],
                    [
                        'title' => 'Retro Barbershop Emblem',
                        'description' => 'Vintage-inspired emblem with hand-drawn lettering and ornamental frame for a premium barbershop.',
                        'image_url' => 'https://placehold.co/800x600/2d1810/d4a574?text=✂️+BARBER+CO&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/2d1810/d4a574?text=✂️+BARBER+CO&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['vintage', 'barbershop', 'retro', 'emblem'],
                    ],
                ],
            ],

            // ─── Thread Design (category 2) ─────────────────
            [
                'category_slug' => 'thread-design',
                'items' => [
                    [
                        'title' => 'Crypto Exchange Banner',
                        'description' => 'Neon-glow forum thread banner for a crypto exchange launch. Dark theme with electric accents.',
                        'image_url' => 'https://placehold.co/800x600/0a0a1a/00d4ff?text=💎+CRYPTO+EXCHANGE&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/0a0a1a/00d4ff?text=💎+CRYPTO+EXCHANGE&font=montserrat',
                        'is_featured' => true,
                        'tags' => ['crypto', 'banner', 'neon', 'exchange'],
                    ],
                    [
                        'title' => 'Gaming Marketplace Thread',
                        'description' => 'Premium thread design for a gaming accounts marketplace. Trust badges and clean layout.',
                        'image_url' => 'https://placehold.co/800x600/12121a/a855f7?text=🎮+GAME+MARKET&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/12121a/a855f7?text=🎮+GAME+MARKET&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['marketplace', 'gaming', 'thread', 'premium'],
                    ],
                    [
                        'title' => 'VPN Service Thread',
                        'description' => 'Sleek thread layout for VPN service promotion with feature highlights and pricing.',
                        'image_url' => 'https://placehold.co/800x600/0d1117/22c55e?text=🔒+SECURE+VPN&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/0d1117/22c55e?text=🔒+SECURE+VPN&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['vpn', 'service', 'dark', 'premium'],
                    ],
                ],
            ],

            // ─── Signature Design (category 3) ──────────────
            [
                'category_slug' => 'signature-design',
                'items' => [
                    [
                        'title' => 'Neon Glow Signature',
                        'description' => 'Animated neon-style forum signature with custom lettering and glow particle effects.',
                        'image_url' => 'https://placehold.co/800x300/0a0a1a/ff1493?text=✨+NEON+SIG&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x150/0a0a1a/ff1493?text=✨+NEON+SIG&font=montserrat',
                        'is_featured' => true,
                        'tags' => ['neon', 'animated', 'glow', 'signature'],
                    ],
                    [
                        'title' => 'Dark Knight Signature',
                        'description' => 'Moody cinematic signature with silhouette art and atmospheric lighting effects.',
                        'image_url' => 'https://placehold.co/800x300/0d0d14/8b8ba3?text=⚔️+DARK+KNIGHT&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x150/0d0d14/8b8ba3?text=⚔️+DARK+KNIGHT&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['dark', 'cinematic', 'silhouette', 'moody'],
                    ],
                    [
                        'title' => 'Cyberpunk Matrix Sig',
                        'description' => 'Matrix-inspired hacker signature with code rain effects and green-on-black aesthetic.',
                        'image_url' => 'https://placehold.co/800x300/001a00/00ff41?text=💻+CYBER+PUNK&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x150/001a00/00ff41?text=💻+CYBER+PUNK&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['cyberpunk', 'hacker', 'matrix', 'code'],
                    ],
                ],
            ],

            // ─── Ads Design (category 4) ────────────────────
            [
                'category_slug' => 'ads-design',
                'items' => [
                    [
                        'title' => 'Black Friday Campaign',
                        'description' => 'High-converting Black Friday ad banner with bold typography, urgency timers, and premium feel.',
                        'image_url' => 'https://placehold.co/800x600/1a1a1a/ff4444?text=🔥+BLACK+FRIDAY+SALE&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/1a1a1a/ff4444?text=🔥+BLACK+FRIDAY&font=montserrat',
                        'is_featured' => true,
                        'tags' => ['sale', 'black-friday', 'banner', 'ecommerce'],
                    ],
                    [
                        'title' => 'Instagram Ad Pack',
                        'description' => 'Set of Instagram story and feed ad creatives for a fitness brand. Multi-format pack.',
                        'image_url' => 'https://placehold.co/800x600/1e1033/e040fb?text=📱+INSTA+ADS&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/1e1033/e040fb?text=📱+INSTA+ADS&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['social-media', 'fitness', 'instagram', 'ads'],
                    ],
                    [
                        'title' => 'Product Launch Banner',
                        'description' => 'Full ad campaign design for a tech product launch across web, social, and email.',
                        'image_url' => 'https://placehold.co/800x600/0f172a/38bdf8?text=🚀+LAUNCH+DAY&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/0f172a/38bdf8?text=🚀+LAUNCH+DAY&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['product', 'launch', 'campaign', 'tech'],
                    ],
                ],
            ],

            // ─── Avatar Design (category 5) ─────────────────
            [
                'category_slug' => 'avatar-design',
                'items' => [
                    [
                        'title' => 'Anime Style Avatar',
                        'description' => 'Custom anime-style character avatar with vibrant colors and expressive design.',
                        'image_url' => 'https://placehold.co/600x600/1a1040/c084fc?text=🎭+ANIME+AVA&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x400/1a1040/c084fc?text=🎭+ANIME+AVA&font=montserrat',
                        'is_featured' => true,
                        'tags' => ['anime', 'avatar', 'character', 'custom'],
                    ],
                    [
                        'title' => 'Realistic Portrait',
                        'description' => 'Digital painting avatar from photo reference. Ultra-realistic style.',
                        'image_url' => 'https://placehold.co/600x600/1a1a2e/e8b4b8?text=👤+PORTRAIT&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x400/1a1a2e/e8b4b8?text=👤+PORTRAIT&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['realistic', 'portrait', 'digital-painting'],
                    ],
                    [
                        'title' => 'Pixel Art Avatar',
                        'description' => '16-bit retro pixel art avatar for gaming profiles. Nostalgic charm.',
                        'image_url' => 'https://placehold.co/600x600/1a0a2e/fbbf24?text=🕹️+PIXEL+ART&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x400/1a0a2e/fbbf24?text=🕹️+PIXEL+ART&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['pixel-art', 'retro', 'gaming', '16bit'],
                    ],
                ],
            ],

            // ─── Custom Design (category 6) ─────────────────
            [
                'category_slug' => 'custom-design',
                'items' => [
                    [
                        'title' => 'Discord Server Pack',
                        'description' => 'Complete Discord branding: server icon, banner, role icons, and channel headers.',
                        'image_url' => 'https://placehold.co/800x600/2c2f33/7289da?text=💬+DISCORD+PACK&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/2c2f33/7289da?text=💬+DISCORD+PACK&font=montserrat',
                        'is_featured' => true,
                        'tags' => ['discord', 'branding', 'server', 'pack'],
                    ],
                    [
                        'title' => 'Twitch Stream Overlay',
                        'description' => 'Full streaming overlay: webcam frame, alerts, panels, and animated transitions.',
                        'image_url' => 'https://placehold.co/800x600/0e0e10/9146ff?text=📺+TWITCH+OVERLAY&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/0e0e10/9146ff?text=📺+TWITCH+OVERLAY&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['twitch', 'stream', 'overlay', 'gaming'],
                    ],
                    [
                        'title' => 'YouTube Channel Kit',
                        'description' => 'Complete YouTube rebrand: banner, thumbnails, intro template, and end screen.',
                        'image_url' => 'https://placehold.co/800x600/1a0000/ff0000?text=▶️+YOUTUBE+KIT&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/1a0000/ff0000?text=▶️+YOUTUBE+KIT&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['youtube', 'branding', 'channel', 'thumbnails'],
                    ],
                ],
            ],

            // ─── 3D Design (category 7) ─────────────────────
            [
                'category_slug' => '3d-design',
                'items' => [
                    [
                        'title' => '3D Logo Animation',
                        'description' => 'Cinematic 3D logo reveal with metallic textures, dramatic lighting, and particle effects.',
                        'image_url' => 'https://placehold.co/800x600/0a0a1a/c0c0c0?text=💎+3D+LOGO&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/0a0a1a/c0c0c0?text=💎+3D+LOGO&font=montserrat',
                        'is_featured' => true,
                        'tags' => ['3d', 'logo', 'animation', 'cinematic'],
                    ],
                    [
                        'title' => '3D Product Render',
                        'description' => 'Photorealistic 3D product visualization on a sleek studio backdrop with reflections.',
                        'image_url' => 'https://placehold.co/800x600/1a1a2e/60a5fa?text=📦+3D+RENDER&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/1a1a2e/60a5fa?text=📦+3D+RENDER&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['3d', 'mockup', 'product', 'render'],
                    ],
                    [
                        'title' => '3D Character Model',
                        'description' => 'Stylized low-poly character model for indie games. Fully rigged and textured.',
                        'image_url' => 'https://placehold.co/800x600/1e1033/f472b6?text=🧊+3D+CHAR&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/1e1033/f472b6?text=🧊+3D+CHAR&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['3d', 'character', 'low-poly', 'gaming'],
                    ],
                ],
            ],

            // ─── CSS/Font Design (category 8) ───────────────
            [
                'category_slug' => 'css-font-design',
                'items' => [
                    [
                        'title' => 'Graffiti Typeface',
                        'description' => 'Street art inspired custom font with urban character. Full alphabet, numbers, and symbols.',
                        'image_url' => 'https://placehold.co/800x600/1a1a1a/ff6b6b?text=🔤+GRAFFITI+FONT&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/1a1a1a/ff6b6b?text=🔤+GRAFFITI+FONT&font=montserrat',
                        'is_featured' => true,
                        'tags' => ['font', 'graffiti', 'typeface', 'urban'],
                    ],
                    [
                        'title' => 'CSS Text Animations',
                        'description' => 'Collection of CSS text effects: glitch, neon pulse, liquid fill, gradient wave.',
                        'image_url' => 'https://placehold.co/800x600/0d1117/22d3ee?text=✨+CSS+EFFECTS&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/0d1117/22d3ee?text=✨+CSS+EFFECTS&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['css', 'animation', 'text-effects', 'web'],
                    ],
                    [
                        'title' => 'Elegant Script Font',
                        'description' => 'Handwritten script font family with multiple weights, swashes, and ligatures.',
                        'image_url' => 'https://placehold.co/800x600/1a0a2e/dda0dd?text=✍️+SCRIPT+FONT&font=montserrat',
                        'thumbnail_url' => 'https://placehold.co/400x300/1a0a2e/dda0dd?text=✍️+SCRIPT+FONT&font=montserrat',
                        'is_featured' => false,
                        'tags' => ['font', 'script', 'elegant', 'handwritten'],
                    ],
                ],
            ],
        ];

        $sortOrder = 1;

        foreach ($portfolioData as $categoryGroup) {
            $category = $categories->get($categoryGroup['category_slug']);
            if (!$category) continue;

            foreach ($categoryGroup['items'] as $item) {
                PortfolioItem::create([
                    'category_id' => $category->id,
                    'title' => $item['title'],
                    'description' => $item['description'],
                    'image_url' => $item['image_url'],
                    'thumbnail_url' => $item['thumbnail_url'],
                    'width' => 800,
                    'height' => 600,
                    'file_type' => 'image',
                    'file_size' => rand(200000, 800000),
                    'is_featured' => $item['is_featured'],
                    'is_active' => true,
                    'sort_order' => $sortOrder++,
                    'tags' => $item['tags'],
                ]);
            }
        }

        $this->command->info('Created ' . ($sortOrder - 1) . ' demo portfolio items.');
    }
}
