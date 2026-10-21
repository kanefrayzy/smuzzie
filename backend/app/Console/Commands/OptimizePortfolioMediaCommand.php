<?php

namespace App\Console\Commands;

use App\Models\PortfolioItem;
use App\Services\MediaOptimizer;
use Illuminate\Console\Command;

class OptimizePortfolioMediaCommand extends Command
{
    protected $signature = 'portfolio:optimize-media
        {--force : Regenerate variants even for items that already have them}
        {--id=* : Only process these item IDs}';

    protected $description = 'Generate web-optimized variants (responsive WebP, MP4 previews, posters) for portfolio items';

    public function handle(MediaOptimizer $optimizer): int
    {
        $query = PortfolioItem::query()->whereNotNull('local_path')->orderBy('id');

        if ($ids = $this->option('id')) {
            $query->whereIn('id', $ids);
        } elseif (!$this->option('force')) {
            $query->whereNull('variants');
        }

        $total = $query->count();
        if ($total === 0) {
            $this->info('Nothing to process — all items already have variants.');
            return self::SUCCESS;
        }

        $this->info("Processing {$total} item(s)...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $failed = [];
        $query->chunkById(50, function ($items) use ($optimizer, $bar, &$failed) {
            foreach ($items as $item) {
                if (!$optimizer->process($item)) {
                    $failed[] = "#{$item->id} {$item->title}";
                }
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);
        $this->info(($total - count($failed)) . " processed, " . count($failed) . " failed.");
        foreach ($failed as $f) {
            $this->warn("  failed: {$f} (see storage/logs/laravel.log)");
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
