<?php

namespace App\Http\Middleware;

use App\Services\Mail\MailSender;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Emails triggered by a request are sent after the response (see MailSender): handle() starts
 * collecting them, terminate() sends them. Laravel calls terminate() after the response went
 * out, which under PHP-FPM is after fastcgi_finish_request(), so SMTP time never reaches the
 * visitor. Global and first in the stack, so it wraps every route and error response.
 */
class SendMailAfterResponse
{
    public function __construct(private MailSender $mail)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $this->mail->defer();

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        $this->mail->flush();
    }
}
