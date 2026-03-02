<?php

namespace App\Console\Commands;

use App\Models\PortfolioItem;
use App\Services\LocalStorageService;
use Illuminate\Console\Command;

class RegenerateVideoThumbnails extends Command
{
    protected $signature = 'portfolio:video-thumbnails {--force : Regenerate even if thumbnail already exists}';
    protected $description = 'Generate JPG poster thumbnails for existing video portfolio items using FFmpeg';

    public function handle()
    {
        $storage = new LocalStorageService();

        $query = PortfolioItem::where('file_type', 'video');

        if (!$this->option('force')) {
            // Only process videos whose thumbnail_url ends with a video extension (i.e. no real poster yet)
            $query->where(function ($q) {
                $q->whereRaw("thumbnail_url LIKE '%.mp4'")
                  ->orWhereRaw("thumbnail_url LIKE '%.webm'")
                  ->orWhereColumn('thumbnail_url', 'image_url');
            });
        }

        $videos = $query->get();

        if ($videos->isEmpty()) {
            $this->info('No videos need thumbnail generation.');
            return 0;
        }

        $this->info("Found {$videos->count()} video(s) to process...");
        $bar = $this->output->createProgressBar($videos->count());
        $bar->start();

        $success = 0;
        $failed = 0;

        foreach ($videos as $item) {
            if (!$item->local_path) {
                $this->newLine();
                $this->warn("  Skipping #{$item->id} ({$item->title}): no local_path");
                $failed++;
                $bar->advance();
                continue;
            }

            $thumbnailUrl = $storage->generateVideoThumbnail($item->local_path, 400, 300);

            // Check if it actually generated (not just returned the video URL back)
            if ($thumbnailUrl && !str_ends_with($thumbnailUrl, '.mp4') && !str_ends_with($thumbnailUrl, '.webm')) {
                $item->update(['thumbnail_url' => $thumbnailUrl]);
                $success++;
            } else {
                $this->newLine();
                $this->warn("  Failed for #{$item->id} ({$item->title})");
                $failed++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Done! {$success} thumbnails generated, {$failed} failed.");

        return 0;
    }
}
