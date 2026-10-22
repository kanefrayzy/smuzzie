<?php

namespace App\Console\Commands;

use App\Enums\BannerOrderStatus;
use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Daily housekeeping for the banner builder (scheduled in App\Console\Kernel):
 *  - unpaid orders older than 7 days, with their logos;
 *  - test renders older than 7 days;
 *  - rendered MP4/GIF files 30 days after they were ready (the order and its settings stay;
 *    "Render again" rebuilds them);
 *  - temp render folders older than a day;
 *  - template masters/uploads/previews that nothing refers to any more;
 *  - files of deleted fonts that no template or order uses.
 */
class BannersCleanupCommand extends Command
{
    protected $signature = 'banners:cleanup {--dry-run : Only report what would be removed}';

    protected $description = 'Remove expired banner orders, old result files and unused banner media';

    private bool $dry = false;

    public function handle(): int
    {
        $this->dry = (bool) $this->option('dry-run');
        $retention = config('banners.retention');

        $counts = [
            'unpaid orders' => $this->deleteOrders(
                BannerOrder::real()->status(BannerOrderStatus::PendingPayment)->where('created_at', '<', now()->subDays($retention['unpaid_days']))
            ),
            'test renders' => $this->deleteOrders(
                BannerOrder::where('is_test', true)->where('created_at', '<', now()->subDays($retention['test_days']))
            ),
            'expired result files' => $this->purgeResults(now()->subDays($retention['result_days'])),
            'temp folders' => $this->deleteTempFolders(now()->subHours($retention['tmp_hours'])->getTimestamp()),
            'unused template files' => $this->deleteUnusedTemplateFiles(),
            'unused fonts' => $this->deleteUnusedFonts(),
        ];

        foreach ($counts as $what => $n) {
            $this->line(sprintf('%s%s: %d', $this->dry ? '[dry run] ' : '', $what, $n));
        }

        return self::SUCCESS;
    }

    private function deleteOrders($query): int
    {
        $n = 0;
        $query->chunkById(200, function ($orders) use (&$n) {
            foreach ($orders as $order) {
                if (!$this->dry) {
                    $this->private()->deleteDirectory("orders/{$order->token}");
                    $order->delete();
                }
                $n++;
            }
        });
        return $n;
    }

    private function purgeResults($before): int
    {
        $n = 0;
        BannerOrder::status(BannerOrderStatus::Ready)
            ->whereNull('result_purged_at')
            ->where('ready_at', '<', $before)
            ->chunkById(200, function ($orders) use (&$n) {
                foreach ($orders as $order) {
                    if (!$this->dry) {
                        foreach (['mp4', 'gif'] as $format) {
                            if ($path = $order->result[$format]['path'] ?? null) {
                                $this->private()->delete($path);
                            }
                        }
                        $order->update(['result_purged_at' => now()]);
                    }
                    $n++;
                }
            });
        return $n;
    }

    private function deleteTempFolders(int $olderThan): int
    {
        $n = 0;
        foreach ($this->private()->directories('tmp') as $dir) {
            $full = $this->private()->path($dir);
            if (@filemtime($full) < $olderThan) {
                if (!$this->dry) {
                    $this->private()->deleteDirectory($dir);
                }
                $n++;
            }
        }
        return $n;
    }

    /**
     * Masters and uploads on the private disk, previews/posters on the public one, that are not
     * the template's current files and not referenced by any order snapshot.
     */
    private function deleteUnusedTemplateFiles(): int
    {
        $referenced = [];
        BannerTemplate::withTrashed()->get(['id', 'uuid', 'source_path', 'upload_path', 'preview_path', 'poster_path'])
            ->each(function ($t) use (&$referenced) {
                foreach (['source_path', 'upload_path', 'preview_path', 'poster_path'] as $f) {
                    if ($t->$f) {
                        $referenced[$t->$f] = true;
                    }
                }
            });
        BannerOrder::select(['id', 'snapshot'])->chunkById(200, function ($orders) use (&$referenced) {
            foreach ($orders as $o) {
                if ($path = $o->snapshot['media']['source_path'] ?? null) {
                    $referenced[$path] = true;
                }
            }
        });

        $n = 0;
        $dayAgo = now()->subDay()->getTimestamp();
        foreach ([[$this->private(), 'templates'], [$this->public(), 'banners/templates']] as [$disk, $root]) {
            foreach ($disk->allFiles($root) as $file) {
                // Skip fresh files: a template may be processing right now
                if (isset($referenced[$file]) || @filemtime($disk->path($file)) > $dayAgo) {
                    continue;
                }
                if (!$this->dry) {
                    $disk->delete($file);
                }
                $n++;
            }
        }
        return $n;
    }

    /** Soft-deleted fonts whose file no template or order snapshot uses any more. */
    private function deleteUnusedFonts(): int
    {
        $deleted = BannerFont::onlyTrashed()->get();
        if ($deleted->isEmpty()) {
            return 0;
        }

        $used = [];
        BannerTemplate::withTrashed()->get(['id', 'config'])->each(function ($t) use (&$used) {
            foreach ($t->fontIds() as $id) {
                $used[$id] = true;
            }
        });
        BannerOrder::select(['id', 'snapshot'])->chunkById(200, function ($orders) use (&$used) {
            foreach ($orders as $o) {
                foreach ($o->snapshot['fonts'] ?? [] as $f) {
                    $used[(int) $f['id']] = true;
                }
            }
        });

        $n = 0;
        foreach ($deleted as $font) {
            if (isset($used[$font->id])) {
                continue;
            }
            if (!$this->dry) {
                $this->public()->delete($font->path);
                $font->forceDelete();
            }
            $n++;
        }
        return $n;
    }

    private function private()
    {
        return Storage::disk(config('banners.disks.private'));
    }

    private function public()
    {
        return Storage::disk(config('banners.disks.public'));
    }
}
