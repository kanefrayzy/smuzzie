<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Crypto payments for the banner builder (https://westwallet.io/api_docs).
    // Without both keys checkout shows "payments unavailable".
    'westwallet' => [
        'public_key' => env('WESTWALLET_PUBLIC_KEY'),
        'private_key' => env('WESTWALLET_PRIVATE_KEY'),
        'base_url' => rtrim((string) env('WESTWALLET_BASE_URL', 'https://api.westwallet.io'), '/'),
        'timeout' => (int) env('WESTWALLET_TIMEOUT', 15),
        // Sent with every generated address; WestWallet posts payment notifications here.
        // Default: APP_URL + /api/v1/payments/westwallet/ipn
        'ipn_url' => env('WESTWALLET_IPN_URL'),
        // Optional shared secret appended to ipn_url as ?secret=...; the IPN is rejected without it.
        // Addresses keep the URL they were created with, so changing it breaks older addresses.
        'ipn_secret' => env('WESTWALLET_IPN_SECRET'),
        // The docs: "We are sending IPN only from IP 45.155.121.88". Empty string disables the check.
        'ipn_ips' => array_values(array_filter(array_map('trim', explode(',', (string) env('WESTWALLET_IPN_IPS', '45.155.121.88'))))),
    ],

];
