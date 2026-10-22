<?php

namespace App\Services\Mail;

use Closure;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * The one way the site sends email. Two rules:
 *
 *  1. Mail never fails the caller: every error (no SMTP settings, connection refused, bad
 *     address, a broken view) is logged and swallowed.
 *  2. Mail never slows a page: during an HTTP request, sends are collected and go out after
 *     the response has been delivered (App\Http\Middleware\SendMailAfterResponse flushes them
 *     in its terminate(); PHP-FPM has closed the connection to the browser by then). Outside a
 *     request (queue worker, scheduler, artisan) they go out at once, after the surrounding
 *     database transaction commits, so nothing is mailed for data that gets rolled back.
 *
 * Why not queued mailables: the only worker is the banner worker, which runs one job at a time
 * (renders take up to a minute, template processing several), so a contact auto-reply or a
 * "payment received" email could wait for minutes, and land after the "banner ready" email
 * that the render job sends itself. The default QUEUE_CONNECTION stays "sync".
 *
 * $guard runs right before sending and may return false to skip (used to claim a timestamp
 * column atomically, see BannerNotifications); $release runs when the send failed.
 */
class MailSender
{
    /** @var array<int, array{0: array|string, 1: Mailable, 2: ?Closure, 3: ?Closure}> */
    private array $deferred = [];

    private int $deferring = 0;

    /**
     * @param array<int, string>|string $to
     */
    public function send(array|string $to, Mailable $mail, ?Closure $guard = null, ?Closure $release = null): void
    {
        // Runs right away outside a transaction, after the outermost commit inside one, and
        // never when the transaction is rolled back
        $dispatch = function () use ($to, $mail, $guard, $release) {
            if ($this->deferring > 0) {
                $this->deferred[] = [$to, $mail, $guard, $release];
            } else {
                $this->deliver($to, $mail, $guard, $release);
            }
        };

        try {
            DB::afterCommit($dispatch);
        } catch (\Throwable $e) {
            $dispatch(); // no transaction manager on the connection (not the case in this app)
        }
    }

    /** Start collecting sends until flush() (the HTTP middleware calls this per request). */
    public function defer(): void
    {
        $this->deferring++;
    }

    /** Send everything collected and stop deferring. */
    public function flush(): void
    {
        $this->deferring = max(0, $this->deferring - 1);
        if ($this->deferring > 0) {
            return;
        }
        while ($item = array_shift($this->deferred)) {
            $this->deliver(...$item);
        }
    }

    /** @return bool whether the email was handed to the mail server */
    public function deliver(array|string $to, Mailable $mail, ?Closure $guard = null, ?Closure $release = null): bool
    {
        $recipients = array_values(array_filter((array) $to, fn ($a) => is_string($a) && $a !== ''));
        if (!$recipients) {
            return false;
        }

        try {
            if ($guard && $guard() === false) {
                return false;
            }
            Mail::to($recipients)->send($mail);
            return true;
        } catch (\Throwable $e) {
            Log::warning('Email not sent: ' . class_basename($mail) . ': ' . $e->getMessage(), [
                'mail' => get_class($mail),
                'to' => $recipients,
            ]);
            if ($release) {
                try {
                    $release();
                } catch (\Throwable $e) {
                    Log::warning('Email guard not released: ' . $e->getMessage());
                }
            }
            return false;
        }
    }

    /** Admin notification recipients from MAIL_ADMIN_ADDRESS (comma-separated); empty = none. */
    public static function adminRecipients(): array
    {
        $raw = (string) config('mail.admin_address', '');

        return array_values(array_filter(
            array_map('trim', explode(',', $raw)),
            fn ($a) => filter_var($a, FILTER_VALIDATE_EMAIL) !== false
        ));
    }
}
