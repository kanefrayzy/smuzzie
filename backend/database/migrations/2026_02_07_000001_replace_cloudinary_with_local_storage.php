<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The create migration was later edited to already have local_path and no Cloudinary
        // columns, so on a fresh database there is nothing to change. Guarded to stay idempotent.
        $drop = array_values(array_filter(
            ['cloudinary_public_id', 'cloudinary_thumbnail_id'],
            fn ($column) => Schema::hasColumn('portfolio_items', $column)
        ));
        if ($drop) {
            Schema::table('portfolio_items', function (Blueprint $table) use ($drop) {
                // Remove Cloudinary columns
                $table->dropColumn($drop);
            });
        }

        if (!Schema::hasColumn('portfolio_items', 'local_path')) {
            Schema::table('portfolio_items', function (Blueprint $table) {
                // Add local storage path
                $table->string('local_path')->nullable()->after('gif_url');
            });
        }
    }

    public function down(): void
    {
        Schema::table('portfolio_items', function (Blueprint $table) {
            $table->dropColumn('local_path');
            $table->string('cloudinary_public_id')->nullable()->after('gif_url');
            $table->string('cloudinary_thumbnail_id')->nullable()->after('cloudinary_public_id');
        });
    }
};
