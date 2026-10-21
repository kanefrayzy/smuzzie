<?php

namespace Database\Factories;

use App\Enums\BannerOrderStatus;
use App\Models\BannerTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bare order row for tests that don't go through BannerOrderService.
 * The snapshot here is minimal; service tests build real snapshots.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\BannerOrder>
 */
class BannerOrderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'template_id' => BannerTemplate::factory()->published(),
            'email' => fake()->safeEmail(),
            'status' => BannerOrderStatus::PendingPayment,
            'params' => ['schemaVersion' => 1, 'hue' => 0, 'zones' => []],
            'snapshot' => ['snapshotVersion' => 1],
            'amount' => 15,
            'currency' => 'USD',
        ];
    }

    public function ready(): static
    {
        return $this->state(fn () => [
            'status' => BannerOrderStatus::Ready,
            'paid_at' => now(),
            'queued_at' => now(),
            'rendering_started_at' => now(),
            'ready_at' => now(),
            'result' => [
                'mp4' => ['path' => 'orders/test/banner.mp4', 'size' => 1024],
                'gif' => ['path' => 'orders/test/banner.gif', 'size' => 2048],
            ],
        ]);
    }
}
