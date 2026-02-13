'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

function SpartanHelmet({ size }: { size: number }) {
  // Aspect ratio of the cropped SVG viewBox: 530 x 880 ≈ 0.602
  const height = Math.round(size * (880 / 530));
  return (
    <Image
      src="/images/logo.svg"
      alt="Logo"
      width={size}
      height={height}
      className="drop-shadow-[0_0_12px_rgba(230,57,70,0.5)]"
      priority
    />
  );
}

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizes = {
    sm: { svg: 22, text: 'text-lg' },
    md: { svg: 28, text: 'text-xl' },
    lg: { svg: 38, text: 'text-2xl' },
    xl: { svg: 56, text: 'text-4xl' },
  };

  const s = sizes[size];

  return (
    <Link href="/" className={`flex items-center gap-2.5 group ${className}`}>
      <div className="relative group-hover:scale-110 transition-transform duration-500">
        <SpartanHelmet size={s.svg} />
      </div>
      {showText && (
        <span className={`font-display font-black ${s.text} tracking-tight`}>
          <span className="text-white">SmuzZie</span>
          <span className="text-accent-red"> Services</span>
        </span>
      )}
    </Link>
  );
}

export { SpartanHelmet };
