'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import MagicWandIcon from './MagicWandIcon';

interface GetStartedButtonProps {
  href?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function GetStartedButton({
  href = '/get-started',
  onClick,
  size = 'md',
  className = '',
}: GetStartedButtonProps) {
  const sizeClasses = {
    sm: 'px-5 py-2 text-xs gap-1.5',
    md: 'px-8 py-3.5 text-sm gap-2.5',
    lg: 'px-10 py-4 text-base gap-3',
  };

  const iconSize = { sm: 14, md: 18, lg: 22 };

  const buttonContent = (
    <motion.span
      className={`btn-get-started ${sizeClasses[size]} ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Sparkle effect on the left */}
      <span className="sparkle-icon">✨</span>

      {/* Button text */}
      <span className="relative z-10 font-bold tracking-wide">Get Started</span>

      {/* Magic wand icon on the right */}
      <MagicWandIcon size={iconSize[size]} className="sparkle-icon" />
    </motion.span>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="group">
        {buttonContent}
      </button>
    );
  }

  return (
    <Link href={href} className="group">
      {buttonContent}
    </Link>
  );
}
