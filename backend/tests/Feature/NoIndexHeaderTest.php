<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NoIndexHeaderTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_responses_are_noindex(): void
    {
        $this->getJson('/api/v1/categories')->assertOk()->assertHeader('X-Robots-Tag', 'noindex');
    }

    public function test_error_responses_are_noindex(): void
    {
        $this->getJson('/api/v1/does-not-exist')->assertNotFound()->assertHeader('X-Robots-Tag', 'noindex');
    }
}
