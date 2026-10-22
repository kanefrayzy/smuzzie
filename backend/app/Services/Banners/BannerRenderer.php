<?php

namespace App\Services\Banners;

use App\Models\BannerOrder;

/**
 * Runs the Node renderer (renderer/) for an order and returns the result description.
 * Implemented in the render stage; until then rendering fails with a clear message.
 */
class BannerRenderer
{
    /**
     * @return array{mp4: array{path: string, size: int}, gif?: array{path: string, size: int}, timings: array, fit: array}
     * @throws RenderFailed
     */
    public function render(BannerOrder $order): array
    {
        throw new RenderFailed('The renderer is not installed yet');
    }
}
