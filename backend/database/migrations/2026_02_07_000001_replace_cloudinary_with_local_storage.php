<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portfolio_items', function (Blueprint $table) {
            // Remove Cloudinary columns
            $table->dropColumn(['cloudinary_public_id', 'cloudinary_thumbnail_id']);

            // Add local storage path
            $table->string('local_path')->nullable()->after('gif_url');
        });
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
