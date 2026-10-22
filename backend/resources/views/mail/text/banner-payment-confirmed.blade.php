@extends('mail.text.layout')

@section('content')
Payment received

Thank you! Your payment for the {!! $templateName !!} banner is confirmed and we've started rendering it. We'll email you as soon as the files are ready, usually within a few minutes.

@include('mail.text.rows', ['rows' => $rows])

View order:
{!! $orderUrl !!}

Keep this email: the link is the only way into your order.
@endsection
