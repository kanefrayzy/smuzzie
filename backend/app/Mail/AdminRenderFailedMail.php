<?php

namespace App\Mail;

use App\Models\BannerOrder;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** To MAIL_ADMIN_ADDRESS: a paid order's render failed after the last attempt. */
class AdminRenderFailedMail extends SiteMail
{
    public function __construct(public BannerOrder $order)
    {
    }

    public function envelope(): Envelope
    {
        return $this->adminEnvelope('Render failed: order #' . self::orderNumber($this->order));
    }

    public function content(): Content
    {
        $o = $this->order;
        $error = trim((string) $o->error);

        return $this->page('admin-render-failed', 'Render failed', 'Order #' . self::orderNumber($o) . ' (' . self::templateName($o) . ') failed to render. The buyer has paid and is waiting.', [
            'orderNumber' => self::orderNumber($o),
            'adminUrl' => self::adminOrdersUrl(),
            'error' => $error !== '' ? mb_strimwidth($error, 0, 1000, '…') : 'No error text',
            'rows' => [
                ['Order', '#' . self::orderNumber($o)],
                ['Template', self::templateName($o)],
                ['Price', self::price($o)],
                ['Buyer', (string) $o->email],
                ['Attempts', (string) $o->attempts],
                ['Failed at', $o->failed_at ? $o->failed_at->copy()->utc()->format('M j, Y H:i') . ' UTC' : null],
            ],
        ]);
    }

    protected function reason(): string
    {
        return 'Admin notification for ' . self::siteHost() . ' (MAIL_ADMIN_ADDRESS).';
    }
}
