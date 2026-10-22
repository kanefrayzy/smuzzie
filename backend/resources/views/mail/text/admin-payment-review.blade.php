@extends('mail.text.layout')

@section('content')
{!! $heading !!}

{!! $explanation !!}

@include('mail.text.rows', ['rows' => $rows])

Banner orders (search for {!! $orderNumber !!}):
{!! $adminUrl !!}
@endsection
