{{--
    Summary box: label / value rows.
    @include('mail.partials.rows', ['rows' => [['Template', 'Neon Sale'], ['Transaction', $hash, 'mono'], ...]])
    Rows with an empty value are skipped.
--}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-box" bgcolor="#f6f6f8" style="width:100%;background-color:#f6f6f8;border-radius:10px;margin:0 0 24px;">
  @foreach (array_values(array_filter($rows, fn ($row) => isset($row[1]) && $row[1] !== '')) as $i => $row)
  <tr>
    <td valign="top" class="em-muted em-rule" style="padding:12px 16px;{{ $i ? 'border-top:1px solid #e6e6ea;' : '' }}font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:#6f6f78;width:38%;">{{ $row[0] }}</td>
    <td valign="top" class="em-strong em-rule" style="padding:12px 16px;{{ $i ? 'border-top:1px solid #e6e6ea;' : '' }}font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;font-weight:600;color:#16161a;text-align:right;{{ ($row[2] ?? null) === 'mono' ? $s['mono'] . 'font-weight:400;' : '' }}">{{ $row[1] }}</td>
  </tr>
  @endforeach
</table>
