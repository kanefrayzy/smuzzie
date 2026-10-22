@extends('mail.text.layout')

@section('content')
New contact form message

@include('mail.text.rows', ['rows' => $rows])

{!! $body !!}

Reply to this email to answer the sender. All messages: {!! $adminUrl !!}
@endsection
