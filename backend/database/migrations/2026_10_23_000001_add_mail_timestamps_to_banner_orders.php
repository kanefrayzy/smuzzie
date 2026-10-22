<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When each order email went out (App\Services\Mail\BannerNotifications). A column is claimed
 * with an atomic "update ... where <column> is null" right before sending, so a repeated
 * notification, a re-render or a retry never sends the same email twice. `notified_at`
 * (the "banner ready" email) already exists.
 */
return new class extends Migration
{
    private const COLUMNS = ['received_notified_at', 'paid_notified_at', 'admin_paid_notified_at', 'admin_failed_notified_at'];

    public function up(): void
    {
        Schema::table('banner_orders', function (Blueprint $table) {
            foreach (self::COLUMNS as $column) {
                $table->timestamp($column)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('banner_orders', function (Blueprint $table) {
            $table->dropColumn(self::COLUMNS);
        });
    }
};
