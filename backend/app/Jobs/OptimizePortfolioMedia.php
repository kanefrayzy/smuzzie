<?php

namespace App\Jobs;

use App\Models\PortfolioItem;
use App\Services\MediaOptimizer;
use Illuminate\Foundation\Bus\Dispatchable;

/**
 * Generates web-optimized variants for an uploaded portfolio item.
 *
 * Dispatched with dispatchAfterResponse(): it runs in the same PHP process right
 * after the upload response has been sent, so uploads stay fast and no queue
 * worker is required. Until it finishes the site simply serves the original file.
 */
class OptimizePortfolioMedia
{
    use Dispatchable;

    public function __construct(public int $itemId)
    {
    }

    public function handle(MediaOptimizer $optimizer): void
    {
        $item = PortfolioItem::find($this->itemId);
        if ($item) {
            $optimizer->process($item);
        }
    }
}
