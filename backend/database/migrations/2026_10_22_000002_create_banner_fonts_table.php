<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banner_fonts', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name', 80);
            $table->unsignedSmallInteger('weight')->default(400);
            $table->string('style', 10)->default('normal'); // normal | italic
            $table->string('path');                         // public disk, never overwritten
            $table->unsignedInteger('file_size')->default(0);
            $table->timestamps();
            $table->softDeletes(); // hidden from pickers, file kept for orders that use it
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banner_fonts');
    }
};
