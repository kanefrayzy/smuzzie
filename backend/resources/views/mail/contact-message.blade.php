@extends('mail.layout')

@section('content')
<p style="{{ $s['eyebrow'] }}">Contact form</p>
<h1 class="em-h1" style="{{ $s['h1'] }}">New message from {{ $name }}</h1>

@include('mail.partials.rows', ['rows' => $rows])

<div class="em-box em-text" style="{{ $s['quote'] }}">{!! nl2br(e($body)) !!}</div>

@if ($replyUrl)
@include('mail.partials.button', ['url' => $replyUrl, 'label' => 'Reply to ' . $name])
@endif

<p class="em-muted" style="{{ $s['small'] }}margin:0;">
  Replying to this email answers the sender directly. All messages are also in the
  <a href="{{ $adminUrl }}" target="_blank" class="em-link" style="{{ $s['link'] }}">admin panel</a>.
</p>
@endsection
