<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps search engines from indexing anything Laravel serves (JSON API, downloads). Googlebot
 * fetches the API while rendering the Next.js pages and then reports those URLs in Search
 * Console as "crawled, not indexed" or duplicates. A header rather than robots.txt: blocking
 * the API there would stop Google from rendering the client-side parts of the pages.
 */
class NoIndex
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $response->headers->set('X-Robots-Tag', 'noindex');

        return $response;
    }
}
