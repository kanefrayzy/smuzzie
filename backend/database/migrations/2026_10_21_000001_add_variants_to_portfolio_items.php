<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portfolio_items', function (Blueprint $table) {
            // Web-optimized derivatives (responsive WebP sizes, MP4 previews, poster).
            // Null until App\Services\MediaOptimizer has processed the item.
            $table->json('variants')->nullable()->after('local_path');
        });
    }

    public function down(): void
    {
        Schema::table('portfolio_items', function (Blueprint $table) {
            $table->dropColumn('variants');
        });
    }
};
