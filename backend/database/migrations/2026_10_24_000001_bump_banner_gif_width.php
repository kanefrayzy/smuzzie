<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The GIF output default went from 600 to 1000 px. Templates still on the old default get the
 * new one (or their own width when that is narrower). Widths the admin picked are left alone,
 * and order snapshots keep what they were ordered with.
 */
return new class extends Migration
{
    private const OLD = 600;
    private const NEW = 1000;

    public function up(): void
    {
        $this->each(function (array $outputs, ?int $width) {
            if ((int) ($outputs['gif']['width'] ?? 0) !== self::OLD) {
                return null;
            }
            $outputs['gif']['width'] = $width ? min(self::NEW, $width) : self::NEW;
            return $outputs;
        });
    }

    public function down(): void
    {
        $this->each(function (array $outputs, ?int $width) {
            if ((int) ($outputs['gif']['width'] ?? 0) !== ($width ? min(self::NEW, $width) : self::NEW)) {
                return null;
            }
            $outputs['gif']['width'] = self::OLD;
            return $outputs;
        });
    }

    /** @param callable(array, ?int): ?array $change the new outputs, or null to leave the row alone */
    private function each(callable $change): void
    {
        DB::table('banner_templates')->select(['id', 'outputs', 'width'])->orderBy('id')
            ->chunkById(100, function ($rows) use ($change) {
                foreach ($rows as $row) {
                    $outputs = json_decode((string) $row->outputs, true);
                    if (!is_array($outputs) || !is_array($outputs['gif'] ?? null)) {
                        continue; // image templates have no GIF output
                    }
                    $new = $change($outputs, $row->width !== null ? (int) $row->width : null);
                    if ($new !== null) {
                        DB::table('banner_templates')->where('id', $row->id)->update(['outputs' => json_encode($new)]);
                    }
                }
            });
    }
};
