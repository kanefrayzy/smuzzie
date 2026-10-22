<?php

namespace Tests\Feature\Mail;

use App\Mail\ContactAutoReplyMail;
use App\Mail\ContactMessageMail;
use App\Models\ContactSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** Contact form: admin notification with Reply-To, auto-reply, failures, escaping. */
class ContactMailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['mail.admin_address' => 'owner@example.com', 'banners.frontend_url' => 'https://smuzzie.com']);
    }

    private function submit(array $data = [])
    {
        return $this->postJson('/api/v1/contact', $data + [
            'name' => 'Anna Müller',
            'email' => 'anna@example.com',
            'subject' => 'Logo for a coffee shop',
            'message' => "Hi!\nWhat are your rates?",
        ]);
    }

    public function test_admin_gets_the_message_with_reply_to_and_the_sender_gets_an_auto_reply(): void
    {
        Mail::fake();

        $this->submit()->assertCreated()->assertJsonPath('message', 'Your message has been sent successfully!');

        Mail::assertSent(ContactMessageMail::class, 1);
        Mail::assertSent(ContactMessageMail::class, function (ContactMessageMail $mail) {
            $html = $mail->render();
            return $mail->hasTo('owner@example.com')
                && $mail->hasReplyTo('anna@example.com', 'Anna Müller')
                && $mail->envelope()->subject === '[Smuzzie] Contact form: Logo for a coffee shop'
                && str_contains($html, 'Hi!<br />')
                && str_contains($html, 'mailto:anna@example.com?subject=Re%3A%20Logo%20for%20a%20coffee%20shop');
        });
        Mail::assertSent(ContactAutoReplyMail::class, 1);
        Mail::assertSent(ContactAutoReplyMail::class, function (ContactAutoReplyMail $mail) {
            $html = $mail->render();
            return $mail->hasTo('anna@example.com')
                && !$mail->hasReplyTo('anna@example.com')
                && str_contains($html, 'within 1–2 business days')
                && str_contains($html, 'What are your rates?');
        });
    }

    public function test_reply_to_address_is_used_for_the_auto_reply_when_set(): void
    {
        Mail::fake();
        config(['mail.reply_to_address' => 'studio@example.com']);

        $this->submit()->assertCreated();

        Mail::assertSent(ContactAutoReplyMail::class, fn ($m) => $m->hasReplyTo('studio@example.com'));
        Mail::assertSent(ContactMessageMail::class, fn ($m) => $m->hasReplyTo('anna@example.com') && !$m->hasReplyTo('studio@example.com'));
    }

    public function test_without_an_admin_address_only_the_auto_reply_goes_out(): void
    {
        Mail::fake();
        config(['mail.admin_address' => null]);

        $this->submit()->assertCreated();

        Mail::assertNotSent(ContactMessageMail::class);
        Mail::assertSent(ContactAutoReplyMail::class, 1);
    }

    public function test_request_succeeds_and_the_message_is_stored_when_mail_is_broken(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('Expected response code "250" but got code "535"'));

        $this->submit()->assertCreated();

        $this->assertSame(1, ContactSubmission::count());
    }

    public function test_user_input_is_escaped_in_the_html_email(): void
    {
        Mail::fake();

        // strip_tags in the controller removes real tags; quotes and ampersands are left to the views
        $this->submit(['name' => 'Tom & "Jerry" <script>alert(1)</script>', 'subject' => 'Hi <b>there</b> & "you"', 'message' => 'a & b " \' <img src=x onerror=alert(1)>'])->assertCreated();

        Mail::assertSent(ContactMessageMail::class, function (ContactMessageMail $mail) {
            $html = $mail->render();
            $text = \App\Console\Commands\MailPreviewCommand::renderText($mail);
            return str_contains($html, 'Tom &amp; &quot;Jerry&quot; alert(1)')
                && !str_contains($html, '<script')
                && !str_contains($html, '<img src=x')
                && str_contains($html, 'a &amp; b &quot; &#039;')
                && str_contains($text, 'Tom & "Jerry" alert(1)'); // plain text isn't HTML-escaped
        });

        // Escaping in the views themselves, without the controller's strip_tags
        $raw = new ContactSubmission(['name' => '<script>alert(1)</script>', 'email' => 'x@example.com', 'subject' => '<img src=x onerror=alert(1)>', 'message' => '<a href="javascript:alert(1)">click</a>']);
        foreach ([new ContactMessageMail($raw), new ContactAutoReplyMail($raw)] as $mail) {
            $html = $mail->render();
            $this->assertStringNotContainsString('<script>', $html);
            $this->assertStringNotContainsString('<img src=x', $html);
            $this->assertStringNotContainsString('<a href="javascript', $html);
            $this->assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt;', $html);
        }
    }

    public function test_auto_replies_are_limited_per_address(): void
    {
        Mail::fake();

        $this->submit()->assertCreated();
        $this->submit(['email' => 'ANNA@example.com'])->assertCreated();
        $this->submit()->assertCreated();

        Mail::assertSent(ContactMessageMail::class, 3);
        Mail::assertSent(ContactAutoReplyMail::class, 2);
    }

    public function test_no_auto_reply_or_reply_to_for_an_invalid_address(): void
    {
        Mail::fake();

        $this->submit(['email' => 'not an email'])->assertCreated();

        Mail::assertNotSent(ContactAutoReplyMail::class);
        Mail::assertSent(ContactMessageMail::class, fn ($m) => !$m->hasReplyTo('not an email') && !str_contains($m->render(), 'mailto:'));
    }
}
