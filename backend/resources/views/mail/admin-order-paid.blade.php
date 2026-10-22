@extends('mail.layout')

@section('content')
<p style="{{ $s['eyebrow'] }}">Banner orders</p>
<h1 class="em-h1" style="{{ $s['h1'] }}">New paid order #{{ $orderNumber }}</h1>
<p class="em-text" style="{{ $s['p'] }}">The payment is confirmed and the order is in the render queue. The buyer gets an email when it's ready.</p>

@include('mail.partials.rows', ['rows' => $rows])

@include('mail.partials.button', ['url' => $adminUrl, 'label' => 'Open banner orders'])

<p class="em-muted" style="{{ $s['small'] }}margin:0;">Search for <span style="{{ $s['mono'] }}">{{ $orderNumber }}</span> in Banner orders to open this order.</p>
@endsection
