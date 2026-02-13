<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portfolio_items', function (Blueprint $table) {
            $table->string('thumbnail_url')->nullable()->change();
            $table->string('image_url')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('portfolio_items', function (Blueprint $table) {
            $table->string('thumbnail_url')->nullable(false)->change();
            $table->string('image_url')->nullable(false)->change();
        });
    }
};
