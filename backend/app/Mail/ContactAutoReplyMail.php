<?php

namespace App\Mail;

use App\Models\ContactSubmission;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * To the contact form sender: "we got your message" with a short quote of it. The quote is cut
 * to QUOTE_CHARS so the form can't be used to mail arbitrary long texts to a stranger's
 * address (ContactNotifications also limits auto-replies per address).
 */
class ContactAutoReplyMail extends SiteMail
{
    public const QUOTE_CHARS = 600;

    public function __construct(public ContactSubmission $submission)
    {
    }

    public function envelope(): Envelope
    {
        return $this->customerEnvelope('We got your message');
    }

    public function content(): Content
    {
        $s = $this->submission;
        $name = self::line((string) $s->name, 60);
        $message = trim((string) $s->message);

        return $this->page('contact-auto-reply', 'We got your message', 'Thanks for writing. We usually reply within 1–2 business days.', [
            'name' => $name,
            'subject' => (string) $s->subject,
            'quote' => mb_strlen($message) > self::QUOTE_CHARS ? rtrim(mb_substr($message, 0, self::QUOTE_CHARS)) . '…' : $message,
        ]);
    }

    protected function reason(): string
    {
        return 'You got this email because this address was entered in the contact form on ' . self::siteHost() . '. If that wasn\'t you, you can ignore it.';
    }
}
