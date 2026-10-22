@extends('mail.layout')

@section('content')
<p style="{{ $s['eyebrow'] }}">Needs your attention</p>
<h1 class="em-h1" style="{{ $s['h1'] }}">{{ $heading }}</h1>
<p class="em-text" style="{{ $s['p'] }}">{{ $explanation }}</p>

@include('mail.partials.rows', ['rows' => $rows])

@include('mail.partials.button', ['url' => $adminUrl, 'label' => 'Open banner orders'])

<p class="em-muted" style="{{ $s['small'] }}margin:0;">Search for <span style="{{ $s['mono'] }}">{{ $orderNumber }}</span> in Banner orders. The payment block of the order shows the address and every transaction.</p>
@endsection
