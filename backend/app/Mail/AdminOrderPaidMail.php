<?php

namespace App\Mail;

use App\Models\BannerOrder;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** To MAIL_ADMIN_ADDRESS: a banner order was paid by the buyer and went into the render queue. */
class AdminOrderPaidMail extends SiteMail
{
    public function __construct(public BannerOrder $order, public ?array $payment = null)
    {
    }

    public function envelope(): Envelope
    {
        return $this->adminEnvelope('New paid order #' . self::orderNumber($this->order) . ': ' . self::price($this->order) . ', ' . self::line(self::templateName($this->order), 50));
    }

    public function content(): Content
    {
        $o = $this->order;
        $p = $this->payment ?? [];

        return $this->page('admin-order-paid', 'New paid order', self::price($o) . ' for ' . self::templateName($o) . ' via ' . self::providerName((string) $o->payment_provider) . '. The render is queued.', [
            'orderNumber' => self::orderNumber($o),
            'adminUrl' => self::adminOrdersUrl(),
            'rows' => [
                ['Template', self::templateName($o)],
                ['Order', '#' . self::orderNumber($o)],
                ['Price', self::price($o)],
                ['Buyer', (string) $o->email],
                ['Provider', self::providerName((string) $o->payment_provider)],
                ['Paid', $p['received'] ?? null],
                ['Network', $p['network'] ?? null],
                ['Overpaid', $p['overpaid'] ?? null],
                ['Transaction', $p['tx'] ?? null, 'mono'],
            ],
        ]);
    }

    public static function providerName(string $provider): string
    {
        return match ($provider) {
            'westwallet' => 'WestWallet (crypto)',
            'manual' => 'Confirmed by admin',
            'auto' => 'Auto-approve',
            default => $provider !== '' ? $provider : '—',
        };
    }

    protected function reason(): string
    {
        return 'Admin notification for ' . self::siteHost() . ' (MAIL_ADMIN_ADDRESS).';
    }
}
