<?php

namespace App\Mail;

use App\Models\ContactSubmission;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** To MAIL_ADMIN_ADDRESS: a contact form message. Reply-To is the sender, so "Reply" answers them. */
class ContactMessageMail extends SiteMail
{
    public function __construct(public ContactSubmission $submission)
    {
    }

    public function envelope(): Envelope
    {
        $s = $this->submission;
        $replyTo = self::validEmail($s->email) ? [new Address($s->email, self::line((string) $s->name, 100))] : [];

        return $this->adminEnvelope('Contact form: ' . self::line((string) $s->subject, 70), $replyTo);
    }

    public function content(): Content
    {
        $s = $this->submission;
        $email = (string) $s->email;

        return $this->page('contact-message', 'New contact form message', self::line((string) $s->name, 60) . ': ' . self::line((string) $s->message, 120), [
            'name' => (string) $s->name,
            'email' => $email,
            'subject' => (string) $s->subject,
            'body' => (string) $s->message,
            'replyUrl' => self::validEmail($email) ? 'mailto:' . $email . '?subject=' . rawurlencode('Re: ' . self::line((string) $s->subject, 120)) : null,
            'adminUrl' => self::siteUrl() . '/admin/contacts',
            'rows' => [
                ['Name', (string) $s->name],
                ['Email', $email],
                ['Subject', (string) $s->subject],
                ['Received', ($s->created_at ?? now())->copy()->utc()->format('M j, Y H:i') . ' UTC'],
            ],
        ]);
    }

    public static function validEmail(?string $email): bool
    {
        return is_string($email) && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    protected function reason(): string
    {
        return 'Admin notification for ' . self::siteHost() . ' (MAIL_ADMIN_ADDRESS).';
    }
}
