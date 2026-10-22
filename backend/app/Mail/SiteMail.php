<?php

namespace App\Mail;

use App\Models\BannerOrder;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Base for every site email: one HTML layout (resources/views/mail/layout.blade.php) plus a
 * plain-text version (resources/views/mail/text/), the footer line saying why the reader got
 * it, and the small formatting helpers the order emails share.
 *
 * Mailables take ready values (models and arrays), never query the database while rendering,
 * so `php artisan mail:preview` can render them from sample data.
 */
abstract class SiteMail extends Mailable
{
    private const FONT = 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;';

    /**
     * Inline styles the views share ($s in the views). Email clients drop <style> blocks often
     * enough that everything that matters is inline; the <style> block in the layout only adds
     * dark mode and small-screen tweaks on top.
     */
    public const STYLES = [
        'eyebrow' => self::FONT . 'margin:0 0 8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#d61f2e;',
        'h1' => self::FONT . 'margin:0 0 16px;font-size:24px;line-height:32px;font-weight:700;color:#16161a;',
        'p' => self::FONT . 'margin:0 0 16px;font-size:16px;line-height:26px;color:#3d3d45;',
        'small' => self::FONT . 'margin:0 0 12px;font-size:13px;line-height:20px;color:#6f6f78;',
        'link' => 'color:#d61f2e;text-decoration:underline;',
        'quote' => self::FONT . 'margin:0 0 20px;padding:14px 18px;border-left:3px solid #ff2d3d;background-color:#f6f6f8;font-size:15px;line-height:24px;color:#3d3d45;',
        'mono' => 'font-family:SFMono-Regular,Menlo,Consolas,Liberation Mono,monospace;font-size:13px;word-break:break-all;',
    ];

    /** Footer line: why the reader got this email. */
    abstract protected function reason(): string;

    /**
     * @param string $view name under resources/views/mail/ (the text version has the same name under mail/text/)
     * @param string $preheader inbox preview line
     */
    protected function page(string $view, string $title, string $preheader, array $data = []): Content
    {
        return new Content(
            view: "mail.{$view}",
            text: "mail.text.{$view}",
            with: $data + [
                'title' => $title,
                'preheader' => $preheader,
                'reason' => $this->reason(),
                'siteUrl' => self::siteUrl(),
                'siteHost' => self::siteHost(),
                's' => self::STYLES,
            ],
        );
    }

    /** Emails to buyers and senders: replies go to MAIL_REPLY_TO_ADDRESS when it's set. */
    protected function customerEnvelope(string $subject): Envelope
    {
        $replyTo = trim((string) config('mail.reply_to_address', ''));

        return new Envelope(
            subject: $subject,
            replyTo: filter_var($replyTo, FILTER_VALIDATE_EMAIL) ? [new Address($replyTo, (string) config('mail.from.name'))] : [],
        );
    }

    /** Admin notifications: a prefix to filter on. */
    protected function adminEnvelope(string $subject, array $replyTo = []): Envelope
    {
        return new Envelope(subject: '[Smuzzie] ' . $subject, replyTo: $replyTo);
    }

    // ─── shared values ─────────────────────────────────────────

    public static function siteUrl(): string
    {
        return rtrim((string) config('banners.frontend_url'), '/');
    }

    public static function siteHost(): string
    {
        $host = (string) parse_url(self::siteUrl(), PHP_URL_HOST);

        return $host !== '' ? preg_replace('/^www\./', '', $host) : 'smuzzie.com';
    }

    public static function orderUrl(BannerOrder $order): string
    {
        return self::siteUrl() . '/banners/order/' . $order->token;
    }

    /** The admin order list; it searches by the order number (token prefix). */
    public static function adminOrdersUrl(): string
    {
        return self::siteUrl() . '/admin/banners/orders';
    }

    public static function orderNumber(BannerOrder $order): string
    {
        return substr((string) $order->token, 0, 8);
    }

    public static function templateName(BannerOrder $order): string
    {
        $name = trim((string) ($order->snapshot['template']['name'] ?? ''));

        return $name !== '' ? $name : 'Video banner';
    }

    public static function price(BannerOrder $order): string
    {
        $amount = number_format((float) $order->amount, 2, '.', ',');
        $currency = strtoupper((string) ($order->currency ?: 'USD'));

        return $currency === 'USD' ? '$' . $amount : $amount . ' ' . $currency;
    }

    public static function formats(BannerOrder $order): string
    {
        return ($order->snapshot['outputs']['gif']['enabled'] ?? false) ? 'MP4 and GIF' : 'MP4';
    }

    /** Header-safe text (subjects): one line, trimmed. */
    protected static function line(string $text, int $max = 80): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');

        return mb_strlen($text) > $max ? rtrim(mb_substr($text, 0, $max - 1)) . '…' : $text;
    }
}
