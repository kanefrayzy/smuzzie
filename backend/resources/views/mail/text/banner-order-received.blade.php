@extends('mail.text.layout')

@section('content')
Thanks for your order

Your {!! $templateName !!} banner is saved. Complete the payment and we'll render it in full quality, without the watermark.

@include('mail.text.rows', ['rows' => $rows])

Complete payment:
{!! $orderUrl !!}

On the order page you pick a coin and network and get a deposit address. Once you choose a coin, its price is locked for {!! $lockMinutes !!} minutes.

Unpaid orders are deleted after {!! $unpaidDays !!} days. If you didn't place this order, ignore this email.
@endsection
