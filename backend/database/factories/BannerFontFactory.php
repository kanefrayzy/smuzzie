<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\BannerFont>
 */
class BannerFontFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->randomElement(['Unbounded', 'Manrope', 'Onest']),
            'weight' => fake()->randomElement([400, 700, 800]),
            'style' => 'normal',
            'path' => 'banners/fonts/' . Str::uuid() . '.woff2',
            'file_size' => 12_000,
        ];
    }
}
