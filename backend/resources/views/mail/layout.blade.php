{{--
    Shared HTML layout of every site email (App\Mail\SiteMail).
    Table-based with inline styles; 560 px column (a fixed-width ghost table for Outlook, which
    ignores max-width). The brand mark is live text on a dark cell, not an image, so there is
    nothing to invert or lose in dark mode or with images off. Dark-mode overrides live in the
    <style> block for the clients that support it; everything else falls back to the light look.
    Variables: $title, $preheader, $reason, $siteUrl, $siteHost, $s (styles); section "content".
--}}
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{{ $title }}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table, td, p, a, h1 { font-family: Arial, sans-serif !important; }</style>
<![endif]-->
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media only screen and (max-width: 600px) {
    .em-pad { padding-left: 22px !important; padding-right: 22px !important; }
    .em-h1 { font-size: 22px !important; line-height: 29px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .em-bg { background-color: #0f0f13 !important; }
    .em-card { background-color: #1a1a20 !important; }
    .em-box { background-color: #23232b !important; }
    .em-rule { border-color: #30303a !important; }
    .em-h1, .em-strong { color: #f4f4f6 !important; }
    .em-text { color: #d2d2d8 !important; }
    .em-muted { color: #9a9aa5 !important; }
    .em-link { color: #ff5a66 !important; }
  }
  /* Outlook.com dark mode */
  [data-ogsc] .em-h1, [data-ogsc] .em-strong { color: #f4f4f6 !important; }
  [data-ogsc] .em-text { color: #d2d2d8 !important; }
  [data-ogsc] .em-muted { color: #9a9aa5 !important; }
  [data-ogsb] .em-bg { background-color: #0f0f13 !important; }
  [data-ogsb] .em-card { background-color: #1a1a20 !important; }
  [data-ogsb] .em-box { background-color: #23232b !important; }
</style>
</head>
<body class="em-bg" style="margin:0;padding:0;width:100%;background-color:#f2f2f5;">
{{-- Inbox preview line, padded so the client doesn't pull body text in after it --}}
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{{ $preheader }}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-bg" bgcolor="#f2f2f5" style="width:100%;background-color:#f2f2f5;">
  <tr>
    <td align="center" style="padding:32px 12px 40px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;margin:0 auto;">
        {{-- Brand header --}}
        <tr>
          <td bgcolor="#0b0b0e" style="background-color:#0b0b0e;padding:22px 32px;border-radius:12px 12px 0 0;" class="em-pad">
            <a href="{{ $siteUrl }}" target="_blank" style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:18px;line-height:24px;font-weight:800;letter-spacing:4px;color:#ffffff;text-decoration:none;">SMUZZIE<span style="color:#ff2d3d;">.</span></a>
          </td>
        </tr>
        <tr>
          <td height="3" bgcolor="#ff2d3d" style="height:3px;line-height:3px;font-size:3px;background-color:#ff2d3d;">&nbsp;</td>
        </tr>
        {{-- Body --}}
        <tr>
          <td bgcolor="#ffffff" class="em-card em-pad" style="background-color:#ffffff;padding:36px 32px 28px;border-radius:0 0 12px 12px;">
            @yield('content')
          </td>
        </tr>
        {{-- Footer --}}
        <tr>
          <td align="center" class="em-pad" style="padding:24px 32px 0;">
            <p class="em-muted" style="{{ $s['small'] }}text-align:center;margin:0 0 6px;">
              <a href="{{ $siteUrl }}" target="_blank" class="em-muted" style="color:#6f6f78;font-weight:700;text-decoration:none;">{{ $siteHost }}</a>
              &nbsp;·&nbsp; Design and video banners
            </p>
            <p class="em-muted" style="{{ $s['small'] }}text-align:center;margin:0;">{{ $reason }}</p>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>
