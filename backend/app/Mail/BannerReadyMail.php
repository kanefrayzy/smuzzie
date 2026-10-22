<?php

namespace App\Mail;

use App\Models\BannerOrder;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * "Your banner is ready": a link to the order page, where fresh signed download links are
 * issued. Download links themselves aren't put in the email, so the email never goes stale.
 */
class BannerReadyMail extends SiteMail
{
    public function __construct(public BannerOrder $order)
    {
    }

    public function envelope(): Envelope
    {
        return $this->customerEnvelope('Your banner is ready (order #' . self::orderNumber($this->order) . ')');
    }

    public function content(): Content
    {
        $o = $this->order;
        $days = (int) config('banners.retention.result_days', 30);

        return $this->page('banner-ready', 'Your banner is ready', 'Your ' . self::templateName($o) . ' banner is rendered without the watermark. Download it from your order page.', [
            'templateName' => self::templateName($o),
            'orderNumber' => self::orderNumber($o),
            'orderUrl' => self::orderUrl($o),
            'formats' => self::formats($o),
            'days' => $days,
            'rows' => [
                ['Template', self::templateName($o)],
                ['Order', '#' . self::orderNumber($o)],
                ['Formats', self::formats($o)],
                ['Available for', $days . ' days'],
            ],
        ]);
    }

    protected function reason(): string
    {
        return 'You got this email because you placed an order on ' . self::siteHost() . '.';
    }
}
