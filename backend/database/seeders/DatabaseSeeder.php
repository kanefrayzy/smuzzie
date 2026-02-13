<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Category;
use App\Models\Review;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Create admin user
        User::create([
            'name' => 'Admin',
            'email' => 'admin@designportfolio.com',
            'password' => Hash::make('password123'),
            'role' => 'admin',
        ]);

        // Create categories
        $categories = [
            ['name' => 'Logo Design', 'slug' => 'logo-design', 'icon' => '🎨', 'sort_order' => 1],
            ['name' => 'Thread Design', 'slug' => 'thread-design', 'icon' => '🧵', 'sort_order' => 2],
            ['name' => 'Signature Design', 'slug' => 'signature-design', 'icon' => '✍️', 'sort_order' => 3],
            ['name' => 'Ads Design', 'slug' => 'ads-design', 'icon' => '📢', 'sort_order' => 4],
            ['name' => 'Avatar Design', 'slug' => 'avatar-design', 'icon' => '👤', 'sort_order' => 5],
            ['name' => 'Custom Design', 'slug' => 'custom-design', 'icon' => '🎯', 'sort_order' => 6],
            ['name' => '3D Design', 'slug' => '3d-design', 'icon' => '🔮', 'sort_order' => 7],
            ['name' => 'CSS/Font Design', 'slug' => 'css-font-design', 'icon' => '🔤', 'sort_order' => 8],
        ];

        foreach ($categories as $cat) {
            Category::create($cat);
        }

        // Create sample reviews
        $reviews = [
            [
                'customer_name' => 'Alex Thompson',
                'content' => 'Absolutely incredible work! The logo design exceeded all my expectations. Professional, creative, and delivered on time.',
                'rating' => 5,
                'sort_order' => 1,
            ],
            [
                'customer_name' => 'Sarah Chen',
                'content' => 'Best designer I\'ve worked with. The attention to detail in the 3D design was phenomenal. Highly recommend!',
                'rating' => 5,
                'sort_order' => 2,
            ],
            [
                'customer_name' => 'Marcus Williams',
                'content' => 'Outstanding thread designs that really captured the vibe I was going for. Quick turnaround and amazing communication.',
                'rating' => 5,
                'sort_order' => 3,
            ],
            [
                'customer_name' => 'Emily Rodriguez',
                'content' => 'The custom avatar design was exactly what I needed for my brand. Creative, unique, and professional quality.',
                'rating' => 4,
                'sort_order' => 4,
            ],
            [
                'customer_name' => 'David Park',
                'content' => 'Exceptional CSS/Font design work. The animations and styling were top-notch. Will definitely work together again!',
                'rating' => 5,
                'sort_order' => 5,
            ],
        ];

        foreach ($reviews as $review) {
            Review::create($review);
        }
    }
}
