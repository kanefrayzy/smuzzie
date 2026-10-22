'use client';

import React, { useState } from 'react';

/**
 * Coin or network logo from /public/crypto (see the README there). Falls back to the
 * ticker's first letters if the file is missing. Decorative: the name is always next to it.
 */
export default function CryptoIcon({
  name, kind = 'coin', label, size = 32, className = '',
}: {
  name: string | null;
  kind?: 'coin' | 'network';
  /** Used for the fallback letters */
  label: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = name ? (kind === 'network' ? `/crypto/networks/${name}.svg` : `/crypto/${name}.svg`) : null;

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-full bg-white/10 text-white font-mono font-bold shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.32) }}
      >
        {label.slice(0, 3)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs; next/image adds nothing here
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
