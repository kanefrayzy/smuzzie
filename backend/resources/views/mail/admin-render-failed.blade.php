@extends('mail.layout')

@section('content')
<p style="{{ $s['eyebrow'] }}">Needs your attention</p>
<h1 class="em-h1" style="{{ $s['h1'] }}">Render failed: #{{ $orderNumber }}</h1>
<p class="em-text" style="{{ $s['p'] }}">The render failed after the last attempt. The buyer has paid and is waiting for the files.</p>

@include('mail.partials.rows', ['rows' => $rows])

<p class="em-muted" style="{{ $s['small'] }}margin:0 0 6px;">Error</p>
<div class="em-box em-text" style="{{ $s['quote'] }}{{ $s['mono'] }}">{!! nl2br(e($error)) !!}</div>

@include('mail.partials.button', ['url' => $adminUrl, 'label' => 'Open banner orders'])

<p class="em-muted" style="{{ $s['small'] }}margin:0;">After fixing the cause, press "Render again" on the order (search for <span style="{{ $s['mono'] }}">{{ $orderNumber }}</span>). The full renderer log is in the order details.</p>
@endsection
