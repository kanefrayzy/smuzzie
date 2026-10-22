<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Static templates: a template's background is either a video (MP4/GIF results) or an image
 * (PNG/JPG results). Set by what the admin uploaded; existing templates are videos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banner_templates', function (Blueprint $table) {
            $table->string('kind', 10)->default('video')->after('currency');
        });
    }

    public function down(): void
    {
        Schema::table('banner_templates', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
