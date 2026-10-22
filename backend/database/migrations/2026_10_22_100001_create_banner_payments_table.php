<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One deposit address per order and payment method (coin + network), reused on every visit
        Schema::create('banner_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('banner_orders')->cascadeOnDelete();
            $table->string('provider', 30);
            $table->string('method', 30);   // config key, e.g. usdt-trc20
            $table->string('currency', 20); // provider ticker, e.g. USDTTRC
            $table->string('coin', 12);
            $table->string('network', 20);
            $table->string('address');
            $table->string('dest_tag', 64)->nullable(); // memo / destination tag when the network needs one
            $table->string('label', 30);                // provider address label (derived from the order token)
            $table->string('status', 20)->default('awaiting')->index();

            // Quote: amount_usd at rate (USD per coin) = amount (coin). Rounded up.
            $table->decimal('amount_usd', 12, 2);
            $table->decimal('rate', 24, 10);
            $table->decimal('amount', 32, 12);
            $table->decimal('received', 32, 12)->default(0); // sum of completed incoming transactions
            $table->timestamp('quoted_at')->nullable();
            $table->timestamp('expires_at')->nullable(); // end of the price lock

            $table->timestamp('selected_at')->nullable(); // the buyer's current choice is the latest
            $table->timestamp('detected_at')->nullable(); // first incoming transaction seen
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('last_checked_at')->nullable(); // scheduled sync
            $table->json('meta')->nullable(); // review reason, overpayment, provider response

            $table->timestamps();

            $table->unique(['order_id', 'method']);
            $table->index(['provider', 'label']);
        });

        Schema::create('banner_payment_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained('banner_payments')->cascadeOnDelete();
            $table->string('provider', 30);
            $table->string('provider_id', 64); // transaction id inside the provider
            $table->string('currency', 20);
            $table->decimal('amount', 32, 12);
            $table->string('status', 20); // pending | completed | failed (normalized)
            $table->string('provider_status', 30)->nullable();
            $table->unsignedInteger('confirmations')->default(0);
            $table->string('hash')->nullable();
            $table->timestamp('first_seen_at');
            $table->timestamp('completed_at')->nullable();
            $table->json('raw')->nullable(); // the verified API response
            $table->timestamps();

            $table->unique(['provider', 'provider_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banner_payment_transactions');
        Schema::dropIfExists('banner_payments');
    }
};
