@extends('mail.layout')

@section('content')
<p style="{{ $s['eyebrow'] }}">Order #{{ $orderNumber }}</p>
<h1 class="em-h1" style="{{ $s['h1'] }}">Your banner is ready</h1>
<p class="em-text" style="{{ $s['p'] }}">
  Your <strong class="em-strong" style="color:#16161a;">{{ $templateName }}</strong> banner has been rendered without the watermark.
  Download the {{ $formats }} files from your order page.
</p>

@include('mail.partials.rows', ['rows' => $rows])

@include('mail.partials.button', ['url' => $orderUrl, 'label' => 'Open my order', 'fallback' => true])

<p class="em-muted" style="{{ $s['small'] }}margin:0;">
  The files are kept for {{ $days }} days, so download them soon. The order page always gives you fresh download links.
</p>
@endsection
