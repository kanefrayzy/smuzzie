@extends('mail.layout')

@section('content')
<h1 class="em-h1" style="{{ $s['h1'] }}">Thanks, {{ $name }}</h1>
<p class="em-text" style="{{ $s['p'] }}">
  We got your message and will reply within 1–2 business days. You don't need to send it again.
</p>

<p class="em-muted" style="{{ $s['small'] }}margin:0 0 6px;">Your message: {{ $subject }}</p>
<div class="em-box em-text" style="{{ $s['quote'] }}">{!! nl2br(e($quote)) !!}</div>

<p class="em-text" style="{{ $s['p'] }}margin:0;">
  Meanwhile, have a look at our latest work on <a href="{{ $siteUrl }}" target="_blank" class="em-link" style="{{ $s['link'] }}">{{ $siteHost }}</a>.
</p>
@endsection
