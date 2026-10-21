<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banner_orders', function (Blueprint $table) {
            $table->id();
            $table->uuid('token')->unique(); // public link /banners/order/<token>
            $table->foreignId('template_id')->nullable()->constrained('banner_templates')->nullOnDelete();
            $table->boolean('is_test')->default(false); // admin "test render"
            $table->string('email')->nullable();
            $table->string('status', 20)->default('pending_payment')->index();

            $table->json('params');   // buyer choices, normalized by the server
            $table->json('snapshot'); // full template snapshot at order time; the render reads only this
            $table->json('images')->nullable(); // zone key => private path of the re-encoded PNG

            // Price snapshot and payment fields (payment itself is not implemented yet)
            $table->decimal('amount', 10, 2)->default(0);
            $table->char('currency', 3)->default('USD');
            $table->string('payment_provider', 40)->nullable();
            $table->string('payment_reference')->nullable();

            $table->timestamp('paid_at')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('rendering_started_at')->nullable();
            $table->timestamp('ready_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('result_purged_at')->nullable();

            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('error')->nullable();
            $table->text('render_log')->nullable();
            $table->json('result')->nullable();
            $table->string('ip', 45)->nullable();

            $table->timestamps();

            $table->index(['is_test', 'status', 'created_at']);
            $table->index(['payment_provider', 'payment_reference']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banner_orders');
    }
};
