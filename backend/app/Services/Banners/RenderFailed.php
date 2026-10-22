<?php

namespace App\Services\Banners;

/** A render that failed, with the renderer's output kept for the admin's error log. */
class RenderFailed extends \RuntimeException
{
    public function __construct(string $message, public readonly ?string $log = null)
    {
        parent::__construct($message);
    }
}
