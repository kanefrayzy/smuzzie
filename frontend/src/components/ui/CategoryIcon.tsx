'use client';

import React from 'react';
import {
  PenNib, Scroll, Signature, Megaphone, UserFocus, Shapes, Cube, TextAa,
  Palette, PaintBrush, Diamond, Rocket, Crown, GameController, FilmStrip,
  Monitor, Fire, Target, Lightning, Television, ChatsCircle, Hexagon,
  type Icon, type IconWeight,
} from '@phosphor-icons/react';

/**
 * Category icons (Phosphor, duotone by default).
 *
 * Categories store an icon *key* (e.g. "pen-nib") in their `icon` column; the admin picks it
 * from ICON_OPTIONS. Older rows still hold emoji — those are ignored and the icon is chosen
 * from the category slug instead, then DEFAULT_ICON.
 */
export const CATEGORY_ICONS: Record<string, Icon> = {
  'pen-nib': PenNib,
  scroll: Scroll,
  signature: Signature,
  megaphone: Megaphone,
  'user-focus': UserFocus,
  shapes: Shapes,
  cube: Cube,
  'text-aa': TextAa,
  palette: Palette,
  'paint-brush': PaintBrush,
  diamond: Diamond,
  rocket: Rocket,
  crown: Crown,
  'game-controller': GameController,
  'film-strip': FilmStrip,
  monitor: Monitor,
  fire: Fire,
  target: Target,
  lightning: Lightning,
  television: Television,
  chats: ChatsCircle,
  hexagon: Hexagon,
};

export const ICON_OPTIONS = Object.keys(CATEGORY_ICONS);

const SLUG_ICONS: Record<string, string> = {
  'logo-design': 'pen-nib',
  'thread-design': 'scroll',
  'signature-design': 'signature',
  'ads-design': 'megaphone',
  'avatar-design': 'user-focus',
  'custom-design': 'shapes',
  '3d-design': 'cube',
  'css-font-design': 'text-aa',
};

const DEFAULT_ICON = 'palette';

export function resolveCategoryIcon(icon?: string | null, slug?: string | null): Icon {
  return (
    (icon && CATEGORY_ICONS[icon]) ||
    (slug && CATEGORY_ICONS[SLUG_ICONS[slug]]) ||
    CATEGORY_ICONS[DEFAULT_ICON]
  );
}

interface CategoryIconProps {
  icon?: string | null;
  slug?: string | null;
  size?: number;
  weight?: IconWeight;
  className?: string;
}

export default function CategoryIcon({ icon, slug, size = 16, weight = 'duotone', className }: CategoryIconProps) {
  const Cmp = resolveCategoryIcon(icon, slug);
  return <Cmp size={size} weight={weight} className={className} aria-hidden="true" />;
}

/** Admin picker: a strip of icon buttons. Empty value = "Auto" (picked from the slug). */
export function CategoryIconPicker({ value, onChange, slug }: { value: string; onChange: (v: string) => void; slug?: string }) {
  const current = value && CATEGORY_ICONS[value] ? value : '';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-500 mr-1">Icon:</span>
      <button
        type="button"
        onClick={() => onChange('')}
        title="Auto (based on category)"
        className={`h-9 px-3 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors ${
          current === '' ? 'border-accent-red/60 bg-accent-red/10 text-white' : 'border-white/5 bg-surface text-gray-400 hover:text-white'
        }`}
      >
        <CategoryIcon slug={slug} size={16} /> Auto
      </button>
      {ICON_OPTIONS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          title={key}
          className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
            current === key ? 'border-accent-red/60 bg-accent-red/10 text-accent-red' : 'border-white/5 bg-surface text-gray-400 hover:text-white'
          }`}
        >
          <CategoryIcon icon={key} size={18} />
        </button>
      ))}
    </div>
  );
}
