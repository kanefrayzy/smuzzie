{{--
    Plain-text layout. Text views print values with {!! !!} on purpose: text/plain is never
    parsed as HTML, and {{ }} would turn "Tom & Jerry" into "Tom &amp; Jerry". HTML views always use {{ }}.
--}}
@yield('content')

--
Smuzzie · {!! $siteUrl !!}
{!! $reason !!}
