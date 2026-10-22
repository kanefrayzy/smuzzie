@extends('mail.text.layout')

@section('content')
Render failed: #{!! $orderNumber !!}

The render failed after the last attempt. The buyer has paid and is waiting for the files.

@include('mail.text.rows', ['rows' => $rows])

Error:
{!! $error !!}

Banner orders (search for {!! $orderNumber !!}, then "Render again"):
{!! $adminUrl !!}
@endsection
