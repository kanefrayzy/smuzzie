{{--
    Bulletproof button: the colour sits on the table cell (bgcolor, so it shows with images off
    and in Outlook), padding on the link for the click area, mso-padding-alt for Outlook, which
    ignores padding on inline links. Full width, so it's a big tap target on phones.
    @include('mail.partials.button', ['url' => ..., 'label' => ..., 'fallback' => true])
--}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:8px 0 {{ ($fallback ?? false) ? '12px' : '24px' }};">
  <tr>
    <td align="center" bgcolor="#e0202f" style="background-color:#e0202f;border-radius:8px;mso-padding-alt:16px 24px;">
      <a href="{{ $url }}" target="_blank" style="display:block;padding:16px 24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:17px;line-height:22px;font-weight:700;color:#ffffff;text-decoration:none;text-align:center;border-radius:8px;mso-line-height-rule:exactly;">{{ $label }}</a>
    </td>
  </tr>
</table>
@if ($fallback ?? false)
<p class="em-muted" style="{{ $s['small'] }}margin:0 0 24px;">
  Button not working? Copy this link into your browser:<br>
  <a href="{{ $url }}" target="_blank" class="em-link" style="{{ $s['link'] }}word-break:break-all;">{{ $url }}</a>
</p>
@endif
