@extends('mail.text.layout')

@section('content')
Thanks, {!! $name !!}

We got your message and will reply within 1–2 business days. You don't need to send it again.

Your message: {!! $subject !!}

{!! $quote !!}
@endsection
