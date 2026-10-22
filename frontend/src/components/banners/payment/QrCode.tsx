'use client';

import React, { useEffect, useState } from 'react';

/** QR code of a payment address, drawn locally (the `qrcode` package is loaded on demand). */
export default function QrCode({ value, label, size = 176 }: { value: string; label: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    import('qrcode')
      .then((QR) => QR.toDataURL(value, { errorCorrectionLevel: 'M', margin: 2, width: size * 2, color: { dark: '#000000', light: '#ffffff' } }))
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div className="rounded-lg bg-white p-1.5 shrink-0" style={{ width: size + 12, height: size + 12 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL generated in the browser
        <img src={src} width={size} height={size} alt={label} className="block w-full h-full" />
      ) : (
        <div className="w-full h-full animate-pulse bg-gray-200 rounded" role="img" aria-label={label} />
      )}
    </div>
  );
}
