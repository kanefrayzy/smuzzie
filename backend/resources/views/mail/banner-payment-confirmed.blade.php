@extends('mail.layout')

@section('content')
<p style="{{ $s['eyebrow'] }}">Order #{{ $orderNumber }}</p>
<h1 class="em-h1" style="{{ $s['h1'] }}">Payment received</h1>
<p class="em-text" style="{{ $s['p'] }}">
  Thank you! Your payment for the <strong class="em-strong" style="color:#16161a;">{{ $templateName }}</strong> banner is confirmed
  and we've started rendering it. We'll email you as soon as the files are ready, usually within a few minutes.
</p>

@include('mail.partials.rows', ['rows' => $rows])

@include('mail.partials.button', ['url' => $orderUrl, 'label' => 'View order', 'fallback' => true])

<p class="em-muted" style="{{ $s['small'] }}margin:0;">
  You can also watch the progress on your order page. Keep this email: the link is the only way into your order.
</p>
@endsection
