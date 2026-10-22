<?php

namespace Tests\Feature\Mail;

use App\Console\Commands\MailPreviewCommand;
use App\Mail\BannerReadyMail;
use App\Mail\ContactAutoReplyMail;
use App\Models\ContactSubmission;
use App\Services\Mail\MailSender;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** Sending mechanics (after the response, never throwing) and every template rendering. */
class MailSenderTest extends TestCase
{
    private function mail(): ContactAutoReplyMail
    {
        return new ContactAutoReplyMail(new ContactSubmission(['name' => 'A', 'email' => 'a@example.com', 'subject' => 'S', 'message' => 'M']));
    }

    public function test_sends_are_held_until_flush_while_deferring(): void
    {
        Mail::fake();
        $sender = app(MailSender::class);

        $sender->defer();
        $sender->send('a@example.com', $this->mail());
        Mail::assertNothingSent();

        $sender->flush();
        Mail::assertSent(ContactAutoReplyMail::class, 1);

        // Not deferring (queue worker, scheduler): straight away
        $sender->send('b@example.com', $this->mail());
        Mail::assertSent(ContactAutoReplyMail::class, 2);
    }

    public function test_failures_are_logged_never_thrown_and_released(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));
        $released = false;

        $ok = app(MailSender::class)->deliver('a@example.com', $this->mail(), fn () => true, function () use (&$released) {
            $released = true;
        });

        $this->assertFalse($ok);
        $this->assertTrue($released);
    }

    public function test_guard_can_skip_and_empty_recipients_send_nothing(): void
    {
        Mail::fake();
        $sender = app(MailSender::class);

        $sender->send('a@example.com', $this->mail(), guard: fn () => false);
        $sender->send([], $this->mail());
        $sender->send('', $this->mail());

        Mail::assertNothingSent();
    }

    public function test_every_email_renders_in_html_and_text(): void
    {
        config(['banners.frontend_url' => 'https://smuzzie.com']);

        foreach (MailPreviewCommand::TYPES as $type) {
            $mail = MailPreviewCommand::sample($type);
            $html = $mail->render();
            $text = MailPreviewCommand::renderText($mail);

            $this->assertStringContainsString('SMUZZIE', $html, $type);
            $this->assertStringContainsString('max-width:560px', $html, $type);
            $this->assertStringContainsString('https://smuzzie.com', $html, $type);
            $this->assertMatchesRegularExpression('/<div style="display:none;[^"]*">\S/', $html, "{$type}: preheader");
            $this->assertMatchesRegularExpression('/(You got this email because [^<]*|Admin notification for) smuzzie\.com/', $html, "{$type}: footer reason");
            if ($type !== 'contact-auto-reply') { // the only email without a call to action
                $this->assertStringContainsString('bgcolor="#e0202f"', $html, "{$type}: bulletproof button");
            }
            $this->assertStringNotContainsString('{{', $html, $type);
            $this->assertStringNotContainsString('<', $text, "{$type}: text version has no HTML");
            $this->assertStringContainsString('https://smuzzie.com', $text, $type);
            $this->assertNotSame('', trim((string) $mail->envelope()->subject), $type);
        }
    }

    public function test_preview_command_writes_files_and_sends_with_to(): void
    {
        $dir = storage_path('app/mail-previews');
        File::delete(["{$dir}/banner-ready.html", "{$dir}/banner-ready.txt"]);

        $this->artisan('mail:preview', ['type' => 'banner-ready'])->assertSuccessful();
        $this->assertFileExists("{$dir}/banner-ready.html");
        $this->assertStringContainsString('Your banner is ready', File::get("{$dir}/banner-ready.txt"));

        Mail::fake();
        $this->artisan('mail:preview', ['--to' => 'me@example.com'])->assertSuccessful();
        Mail::assertSent(BannerReadyMail::class, fn ($m) => $m->hasTo('me@example.com'));
        foreach (MailPreviewCommand::TYPES as $type) {
            Mail::assertSent(get_class(MailPreviewCommand::sample($type)), fn ($m) => $m->hasTo('me@example.com'));
        }

        $this->artisan('mail:preview', ['type' => 'nope'])->assertFailed();
        $this->artisan('mail:preview', ['--to' => 'not-an-email'])->assertFailed();
    }
}
