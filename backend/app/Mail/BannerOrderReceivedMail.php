<?php

namespace App\Mail;

use App\Models\BannerOrder;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** To the buyer right after a (real, unpaid) order is created: summary and the payment link. */
class BannerOrderReceivedMail extends SiteMail
{
    public function __construct(public BannerOrder $order)
    {
    }

    public function envelope(): Envelope
    {
        return $this->customerEnvelope('Order #' . self::orderNumber($this->order) . ': complete your payment');
    }

    public function content(): Content
    {
        $o = $this->order;

        return $this->page('banner-order-received', 'Complete your payment', 'Your ' . self::templateName($o) . ' banner is saved. Pay ' . self::price($o) . ' in crypto and we render it without the watermark.', [
            'templateName' => self::templateName($o),
            'orderNumber' => self::orderNumber($o),
            'orderUrl' => self::orderUrl($o),
            'rows' => [
                ['Template', self::templateName($o)],
                ['Price', self::price($o)],
                ['Formats', self::formats($o)],
                ['Order', '#' . self::orderNumber($o)],
            ],
            'lockMinutes' => (int) config('banners.payments.price_lock_minutes', 30),
            'unpaidDays' => (int) config('banners.retention.unpaid_days', 7),
        ]);
    }

    protected function reason(): string
    {
        return 'You got this email because you placed an order on ' . self::siteHost() . '.';
    }
}
