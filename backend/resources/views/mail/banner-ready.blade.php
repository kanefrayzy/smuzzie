<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your banner is ready</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#16161a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#0b0b0e;padding:20px 28px;">
            <span style="color:#ffffff;font-weight:700;font-size:16px;letter-spacing:.04em;">SMUZZIE</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Your banner is ready</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#44444c;">
              Your <strong>{{ $templateName }}</strong> banner (order #{{ $orderNumber }}) has been rendered without the watermark.
              Download the {{ $formats }} files from your order page.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#ff2d3d;">
                  <a href="{{ $orderUrl }}" style="display:inline-block;padding:13px 24px;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;">Open my order</a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#77777f;">
              The files are kept for {{ $days }} days. If the button doesn't work, copy this link:<br>
              <a href="{{ $orderUrl }}" style="color:#77777f;word-break:break-all;">{{ $orderUrl }}</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
