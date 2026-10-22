<?php

namespace App\Services\Payments;

/** The gateway is unreachable or refused a request; `code` is its error string when it gave one. */
class PaymentProviderException extends \RuntimeException
{
    public function __construct(string $message, public readonly ?string $errorCode = null, ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }
}
