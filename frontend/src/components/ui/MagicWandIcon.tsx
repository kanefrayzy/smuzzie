'use client';

import React from 'react';

interface MagicWandIconProps {
  className?: string;
  size?: number;
}

export default function MagicWandIcon({ className = '', size = 18 }: MagicWandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 4V2" />
      <path d="M15 16v-2" />
      <path d="M8 9h2" />
      <path d="M20 9h2" />
      <path d="M17.8 11.8 19 13" />
      <path d="M15 9h0" />
      <path d="M17.8 6.2 19 5" />
      <path d="M3 21l9-9" />
      <path d="M12.2 6.2 11 5" />
    </svg>
  );
}

export function SparklesIcon({ className = '', size = 18 }: MagicWandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
      <path d="M20 5L21 8L24 9L21 10L20 13L19 10L16 9L19 8L20 5Z" opacity="0.6" />
      <path d="M4 17L5 19L7 20L5 21L4 23L3 21L1 20L3 19L4 17Z" opacity="0.4" />
    </svg>
  );
}
