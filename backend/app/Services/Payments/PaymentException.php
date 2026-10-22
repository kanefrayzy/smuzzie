<?php

namespace App\Services\Payments;

/** A checkout request we refuse; the message is shown to the buyer as is. */
class PaymentException extends \RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422, public readonly string $reason = 'invalid')
    {
        parent::__construct($message);
    }
}
