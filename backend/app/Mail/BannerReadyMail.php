<?php

namespace App\Mail;

use App\Models\BannerOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * "Your banner is ready": a link to the order page, where fresh signed download links are
 * issued. Download links themselves aren't put in the email, so the email never goes stale.
 */
class BannerReadyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public BannerOrder $order)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your banner is ready');
    }

    public function content(): Content
    {
        $days = (int) config('banners.retention.result_days', 30);

        return new Content(
            view: 'mail.banner-ready',
            text: 'mail.banner-ready-text',
            with: [
                'templateName' => $this->order->snapshot['template']['name'] ?? 'Your banner',
                'orderUrl' => config('banners.frontend_url') . '/banners/order/' . $this->order->token,
                'orderNumber' => substr($this->order->token, 0, 8),
                'formats' => ($this->order->snapshot['outputs']['gif']['enabled'] ?? false) ? 'MP4 and GIF' : 'MP4',
                'days' => $days,
            ],
        );
    }
}
