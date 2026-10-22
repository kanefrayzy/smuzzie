<?php

namespace App\Console\Commands;

use App\Enums\BannerOrderStatus;
use App\Mail\AdminOrderPaidMail;
use App\Mail\AdminPaymentReviewMail;
use App\Mail\AdminRenderFailedMail;
use App\Mail\BannerOrderReceivedMail;
use App\Mail\BannerPaymentConfirmedMail;
use App\Mail\BannerReadyMail;
use App\Mail\ContactAutoReplyMail;
use App\Mail\ContactMessageMail;
use App\Models\BannerOrder;
use App\Models\ContactSubmission;
use Illuminate\Console\Command;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;

/**
 * Every site email with sample data (nothing is read from or written to the database).
 *
 *   php artisan mail:preview                      all types -> storage/app/mail-previews/<type>.html + .txt
 *   php artisan mail:preview banner-ready         one type
 *   php artisan mail:preview all --to=me@x.com    send them for real through the configured mailer
 *
 * Sending goes straight through the mailer (not after a response), so SMTP errors are printed.
 */
class MailPreviewCommand extends Command
{
    protected $signature = 'mail:preview {type=all : One of the types below, or "all"} {--to= : Send to this address instead of writing files}';

    protected $description = 'Render the site emails with sample data to storage/app/mail-previews, or send them with --to';

    public const TYPES = [
        'order-received', 'payment-confirmed', 'banner-ready',
        'admin-order-paid', 'admin-payment-review', 'admin-render-failed',
        'contact-message', 'contact-auto-reply',
    ];

    public function handle(): int
    {
        $type = (string) $this->argument('type');
        if ($type !== 'all' && !in_array($type, self::TYPES, true)) {
            $this->error("Unknown type \"{$type}\". Types: all, " . implode(', ', self::TYPES));
            return self::INVALID;
        }
        $types = $type === 'all' ? self::TYPES : [$type];

        $to = $this->option('to');
        if ($to !== null && filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
            $this->error('--to must be an email address');
            return self::INVALID;
        }

        return $to !== null ? $this->sendAll($types, $to) : $this->writeAll($types);
    }

    private function writeAll(array $types): int
    {
        $dir = storage_path('app/mail-previews');
        File::ensureDirectoryExists($dir);

        foreach ($types as $type) {
            $mail = self::sample($type);
            File::put("{$dir}/{$type}.html", $mail->render());
            File::put("{$dir}/{$type}.txt", self::renderText($mail));
            $this->line(sprintf('%-22s %-58s %s', $type, '"' . $mail->envelope()->subject . '"', "{$dir}/{$type}.html"));
        }
        $this->info("Written to {$dir} (.html and .txt per type)");

        return self::SUCCESS;
    }

    private function sendAll(array $types, string $to): int
    {
        $mailer = config('mail.default');
        $this->line("Mailer: {$mailer}" . ($mailer === 'smtp' ? ' (' . config('mail.mailers.smtp.host') . ':' . config('mail.mailers.smtp.port') . ')' : '') . ', from: ' . config('mail.from.address'));

        $failed = 0;
        foreach ($types as $type) {
            $mail = self::sample($type);
            try {
                Mail::to($to)->send($mail);
                $this->info(sprintf('sent   %-22s "%s"', $type, $mail->envelope()->subject));
            } catch (\Throwable $e) {
                $failed++;
                $this->error(sprintf('failed %-22s %s', $type, $e->getMessage()));
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    public static function renderText(Mailable $mail): string
    {
        $content = $mail->content();

        return view($content->text, $content->with + $mail->buildViewData())->render();
    }

    /** A mailable of the given type filled with sample data. */
    public static function sample(string $type): Mailable
    {
        $order = self::sampleOrder();
        $payment = [
            'expected' => '15 USDT',
            'received' => '15 USDT',
            'network' => 'Tron (TRC20)',
            'tx' => 'a3f1c09be47d2f8816e0c3b5d9a7e2f4c1b0d8e6f5a4c3b2a1908f7e6d5c4b3a',
            'overpaid' => null,
            'late_value_usd' => null,
        ];

        return match ($type) {
            'order-received' => new BannerOrderReceivedMail(tap($order, fn ($o) => $o->status = BannerOrderStatus::PendingPayment)),
            'payment-confirmed' => new BannerPaymentConfirmedMail($order, $payment),
            'banner-ready' => new BannerReadyMail(tap($order, fn ($o) => $o->status = BannerOrderStatus::Ready)),
            'admin-order-paid' => new AdminOrderPaidMail($order, $payment),
            'admin-payment-review' => new AdminPaymentReviewMail(
                tap($order, fn ($o) => $o->status = BannerOrderStatus::PendingPayment),
                'late_short',
                ['expected' => '0.0001875 BTC', 'received' => '0.0001875 BTC', 'network' => 'Bitcoin', 'tx' => 'b7e4f0c2a9d1e8f3c6b5a4d2e1f0c9b8a7d6e5f4c3b2a1d0e9f8c7b6a5d4e3f2', 'overpaid' => null, 'late_value_usd' => 13.13]
            ),
            'admin-render-failed' => new AdminRenderFailedMail(tap($order, function ($o) {
                $o->status = BannerOrderStatus::Failed;
                $o->attempts = 2;
                $o->failed_at = now();
                $o->error = "Render failed: Font failed to load: bf-1\nat render.html:1:2041";
            })),
            'contact-message' => new ContactMessageMail(self::sampleSubmission()),
            'contact-auto-reply' => new ContactAutoReplyMail(self::sampleSubmission()),
        };
    }

    private static function sampleOrder(): BannerOrder
    {
        $order = new BannerOrder([
            'email' => 'buyer@example.com',
            'amount' => 15,
            'currency' => 'USD',
            'payment_provider' => 'westwallet',
            'snapshot' => [
                'template' => ['name' => 'Neon Sale', 'slug' => 'neon-sale'],
                'outputs' => ['mp4' => true, 'gif' => ['enabled' => true]],
            ],
        ]);
        $order->token = '3f9c2a71-6b0e-4d8a-9c55-1e2f3a4b5c6d';
        $order->status = BannerOrderStatus::Queued;

        return $order;
    }

    private static function sampleSubmission(): ContactSubmission
    {
        $submission = new ContactSubmission([
            'name' => 'Anna Müller',
            'email' => 'anna@example.com',
            'subject' => 'Brand identity for a coffee shop',
            'message' => "Hi! We're opening a small coffee shop in Berlin in spring and need a logo, a menu design and a few animated banners for Instagram.\n\nCould you send me your rates and an estimate of the timeline?\n\nThanks,\nAnna",
        ]);
        $submission->created_at = now();

        return $submission;
    }
}
