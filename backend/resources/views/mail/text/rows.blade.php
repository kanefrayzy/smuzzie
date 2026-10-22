@foreach (array_filter($rows, fn ($row) => isset($row[1]) && $row[1] !== '') as $row)
{!! $row[0] !!}: {!! $row[1] !!}
@endforeach
