import React from 'react';
import { isImageUrl } from '@/lib/utils';

/**
 * Avatar for a person: their photo when `src` is an image URL, otherwise initials
 * on a tinted tile (tint picked from the name so each reviewer gets a stable color).
 */
const TINTS = [
  'from-accent-red/30 to-accent-red-deep/40 text-accent-red',
  'from-purple-500/25 to-purple-900/40 text-purple-300',
  'from-amber-500/25 to-amber-900/40 text-amber-300',
  'from-sky-500/25 to-sky-900/40 text-sky-300',
  'from-emerald-500/25 to-emerald-900/40 text-emerald-300',
  'from-rose-500/25 to-rose-900/40 text-rose-300',
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || '';
  return (first + last).toUpperCase();
}

function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export default function Monogram({ name, src, className = '' }: { name: string; src?: string | null; className?: string }) {
  if (isImageUrl(src)) {
    return <img src={src!} alt={name} loading="lazy" className={`w-full h-full object-cover ${className}`} />;
  }
  return (
    <span
      className={`w-full h-full flex items-center justify-center bg-gradient-to-br font-display font-bold text-sm tracking-wide ${tintFor(name)} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
