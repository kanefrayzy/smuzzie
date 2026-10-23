<?php

namespace App\Console\Commands;

use App\Models\BannerFont;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Bulk import of woff2 faces into the banner font library, e.g. a folder of Google Fonts:
 *   <dir>/Fira_Sans/FiraSans-SemiBoldItalic.woff2  ->  "Fira Sans", 600, italic
 * The family comes from the folder name, weight and style from the last "-" part of the file
 * name (no suffix = Regular). Same checks as the admin upload; faces already in the library
 * (same name, weight and style) are skipped, so running it twice is safe.
 */
class BannerFontsImportCommand extends Command
{
    protected $signature = 'banners:import-fonts {dir : Folder with one subfolder per family} {--dry-run : Only list what would be imported}';

    protected $description = 'Import a folder of woff2 fonts into the banner font library';

    private const WEIGHTS = [
        'thin' => 100, 'hairline' => 100, 'extralight' => 200, 'ultralight' => 200, 'light' => 300,
        'regular' => 400, 'normal' => 400, 'book' => 400, 'medium' => 500, 'semibold' => 600, 'demibold' => 600,
        'bold' => 700, 'extrabold' => 800, 'ultrabold' => 800, 'black' => 900, 'heavy' => 900,
    ];

    public function handle(): int
    {
        $dir = rtrim((string) $this->argument('dir'), '/\\');
        if (!is_dir($dir)) {
            $this->error("No such folder: {$dir}");
            return self::FAILURE;
        }

        $files = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if ($file->isFile() && strtolower($file->getExtension()) === 'woff2') {
                $files[] = $file->getPathname();
            }
        }
        sort($files);

        $maxBytes = (int) config('banners.fonts.max_kb', 2048) * 1024;
        $disk = Storage::disk(config('banners.disks.public'));
        $added = $skipped = $failed = 0;

        foreach ($files as $path) {
            $face = self::parse($path);
            $label = "{$face['name']} {$face['weight']}" . ($face['style'] === 'italic' ? ' italic' : '');

            if (BannerFont::where('name', $face['name'])->where('weight', $face['weight'])->where('style', $face['style'])->exists()) {
                $skipped++;
                $this->line("skip  {$label} (already there)");
                continue;
            }
            $size = filesize($path);
            if ($size > $maxBytes || file_get_contents($path, false, null, 0, 4) !== 'wOF2') {
                $failed++;
                $this->warn("fail  {$label}: not a woff2 file or larger than " . ($maxBytes / 1024) . ' KB (' . basename($path) . ')');
                continue;
            }
            if ($this->option('dry-run')) {
                $added++;
                $this->line("add   {$label}");
                continue;
            }

            $uuid = (string) Str::uuid();
            $stored = "banners/fonts/{$uuid}.woff2";
            $stream = fopen($path, 'rb');
            $ok = $disk->put($stored, $stream);
            fclose($stream);
            if (!$ok) {
                $failed++;
                $this->warn("fail  {$label}: could not store the file");
                continue;
            }
            $font = new BannerFont(['name' => $face['name'], 'weight' => $face['weight'], 'style' => $face['style'], 'path' => $stored, 'file_size' => $size]);
            $font->uuid = $uuid;
            $font->save();
            $added++;
            $this->line("add   {$label}");
        }

        $verb = $this->option('dry-run') ? 'would be added' : 'added';
        $this->info("{$added} {$verb}, {$skipped} already there, {$failed} failed");

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    /** @return array{name: string, weight: int, style: string} */
    public static function parse(string $path): array
    {
        $family = trim(preg_replace('/\s+/', ' ', str_replace(['_', '-'], ' ', basename(dirname($path)))));
        $base = pathinfo($path, PATHINFO_FILENAME);
        $suffix = str_contains($base, '-') ? strtolower(substr($base, strrpos($base, '-') + 1)) : 'regular';

        $italic = str_ends_with($suffix, 'italic') || str_ends_with($suffix, 'oblique');
        $suffix = preg_replace('/(italic|oblique)$/', '', $suffix);
        $weight = self::WEIGHTS[$suffix === '' ? 'regular' : $suffix] ?? 400;

        return ['name' => Str::limit($family, 80, ''), 'weight' => $weight, 'style' => $italic ? 'italic' : 'normal'];
    }
}
