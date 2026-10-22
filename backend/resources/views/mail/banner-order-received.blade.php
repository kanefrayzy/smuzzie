@extends('mail.layout')

@section('content')
<p style="{{ $s['eyebrow'] }}">Order #{{ $orderNumber }}</p>
<h1 class="em-h1" style="{{ $s['h1'] }}">Thanks for your order</h1>
<p class="em-text" style="{{ $s['p'] }}">
  Your <strong class="em-strong" style="color:#16161a;">{{ $templateName }}</strong> banner is saved.
  Complete the payment and we'll render it in full quality, without the watermark.
</p>

@include('mail.partials.rows', ['rows' => $rows])

@include('mail.partials.button', ['url' => $orderUrl, 'label' => 'Complete payment', 'fallback' => true])

<p class="em-text" style="{{ $s['p'] }}font-size:15px;line-height:24px;">
  On the order page you pick a coin and network and get a deposit address.
  Once you choose a coin, its price is locked for <strong class="em-strong" style="color:#16161a;">{{ $lockMinutes }} minutes</strong>.
</p>
<p class="em-muted" style="{{ $s['small'] }}margin:0;">
  Unpaid orders are deleted after {{ $unpaidDays }} days. If you didn't place this order, ignore this email.
</p>
@endsection
