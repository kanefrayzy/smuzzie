@extends('mail.text.layout')

@section('content')
New paid order #{!! $orderNumber !!}

The payment is confirmed and the order is in the render queue.

@include('mail.text.rows', ['rows' => $rows])

Banner orders (search for {!! $orderNumber !!}):
{!! $adminUrl !!}
@endsection
