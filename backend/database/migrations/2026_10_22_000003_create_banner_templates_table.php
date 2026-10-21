<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banner_templates', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->char('currency', 3)->default('USD');
            $table->boolean('is_active')->default(false);
            $table->integer('sort_order')->default(0);

            // Zones and buyer controls (format: docs/banners/PLAN.md §2), output formats, preview watermark
            $table->json('config');
            $table->json('outputs');
            $table->json('watermark');

            // Media. Source files live on the private "banners" disk, preview/poster on "public".
            // Every new upload bumps source_rev and gets new file names, so orders keep their files.
            $table->unsignedInteger('source_rev')->default(0);
            $table->string('upload_path')->nullable();
            $table->string('source_path')->nullable();
            $table->string('preview_path')->nullable();
            $table->string('poster_path')->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedInteger('frame_count')->nullable();
            $table->decimal('duration', 8, 3)->nullable();
            $table->decimal('fps', 7, 3)->nullable();

            $table->string('processing_status', 20)->default('none'); // none|pending|processing|ready|failed
            $table->text('processing_error')->nullable();
            $table->timestamp('processed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banner_templates');
    }
};
