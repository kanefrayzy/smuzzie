<?php

namespace App\Services\Mail;

use App\Mail\ContactAutoReplyMail;
use App\Mail\ContactMessageMail;
use App\Models\ContactSubmission;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Contact form emails: the message to the admin (Reply-To = sender) and a short auto-reply to
 * the sender. Both go out after the response (MailSender) and never fail the request.
 *
 * The auto-reply goes to whatever address was typed into the form, so it is limited per
 * address (AUTO_REPLIES_PER_DAY) on top of the form's own 3/min per IP: otherwise the form
 * could be used to send our "thanks" email, with a quote, to a stranger again and again.
 */
class ContactNotifications
{
    public const AUTO_REPLIES_PER_DAY = 2;

    public function __construct(private MailSender $mail)
    {
    }

    public function submitted(ContactSubmission $submission): void
    {
        $this->mail->send(MailSender::adminRecipients(), new ContactMessageMail($submission));

        $email = strtolower(trim((string) $submission->email));
        if (!ContactMessageMail::validEmail($email)) {
            return;
        }
        $key = 'contact-auto-reply:' . sha1($email);
        if (RateLimiter::tooManyAttempts($key, self::AUTO_REPLIES_PER_DAY)) {
            return;
        }
        RateLimiter::hit($key, 86400);
        $this->mail->send($email, new ContactAutoReplyMail($submission));
    }
}
