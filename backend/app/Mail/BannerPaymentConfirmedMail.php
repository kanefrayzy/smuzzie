<?php

namespace App\Mail;

use App\Models\BannerOrder;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * To the buyer when the order became paid: the render has started, the next email is
 * "your banner is ready". $payment: crypto payment details (BannerNotifications::paymentDetails),
 * null for a payment the admin confirmed by hand.
 */
class BannerPaymentConfirmedMail extends SiteMail
{
    public function __construct(public BannerOrder $order, public ?array $payment = null)
    {
    }

    public function envelope(): Envelope
    {
        return $this->customerEnvelope('Payment received for order #' . self::orderNumber($this->order));
    }

    public function content(): Content
    {
        $o = $this->order;
        $p = $this->payment ?? [];

        return $this->page('banner-payment-confirmed', 'Payment received', 'Your ' . self::templateName($o) . ' banner is being rendered. We\'ll email you when it\'s ready.', [
            'templateName' => self::templateName($o),
            'orderNumber' => self::orderNumber($o),
            'orderUrl' => self::orderUrl($o),
            'rows' => [
                ['Template', self::templateName($o)],
                ['Order', '#' . self::orderNumber($o)],
                ['Price', self::price($o)],
                ['Paid', $p['received'] ?? null],
                ['Network', $p['network'] ?? null],
                ['Transaction', $p['tx'] ?? null, 'mono'],
                ['Formats', self::formats($o)],
            ],
        ]);
    }

    protected function reason(): string
    {
        return 'You got this email because you placed an order on ' . self::siteHost() . '.';
    }
}
