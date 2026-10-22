'use client';

import React, { useRef, useState } from 'react';
import {
  Upload, X, AlignLeft, AlignCenter, AlignRight, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
} from 'lucide-react';
import { resolveImage } from '@/lib/banner-overlay';
import type { Align, AlignY, ImageZone, ImageZoneParams } from '@/lib/banner-overlay';
import { formatFileSize } from '@/lib/utils';
import { Segmented, Slider } from './ui';
import type { DraftImage } from './draft';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIDE = 4096;
const MAX_PIXELS = 16_000_000;

const X_ICON: Record<Align, React.ReactNode> = {
  left: <AlignLeft size={14} />,
  center: <AlignCenter size={14} />,
  right: <AlignRight size={14} />,
};
const Y_ICON: Record<AlignY, React.ReactNode> = {
  top: <AlignStartHorizontal size={14} />,
  center: <AlignCenterHorizontal size={14} />,
  bottom: <AlignEndHorizontal size={14} />,
};

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}

/** Logo upload (drag and drop), size and alignment inside the zone. */
export default function ImageZoneControls({
  zone, params, image, onChange, onImage,
}: {
  zone: ImageZone;
  params: ImageZoneParams | undefined;
  image: DraftImage | undefined;
  onChange: (patch: ImageZoneParams) => void;
  onImage: (image: DraftImage | null) => void;
}) {
  const c = zone.controls;
  const r = resolveImage(zone, params);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    setError('');
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setError('Use PNG, JPG or WebP. SVG is not supported.');
      return;
    }
    if (file.size > c.upload.maxBytes) {
      setError(`The file is larger than ${formatFileSize(c.upload.maxBytes)}.`);
      return;
    }
    try {
      const dataUrl = await readDataUrl(file);
      const { w, h } = await imageSize(dataUrl);
      if (w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS) {
        setError(`The image is too large (${w}×${h}). Up to ${MAX_SIDE} px on a side.`);
        return;
      }
      onImage({ dataUrl, name: file.name, size: file.size });
    } catch {
      setError('Could not read this image.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <label
        className={`flex items-center gap-3 p-3 rounded-lg border border-dashed cursor-pointer transition-colors ${
          over ? 'border-accent-red/60 bg-accent-red/5' : 'border-white/[0.12] hover:border-accent-red/40 bg-white/[0.02]'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files[0]);
        }}
      >
        <span
          className="w-16 h-11 shrink-0 rounded-md flex items-center justify-center overflow-hidden"
          style={{ background: 'repeating-conic-gradient(#1b1b22 0 25%, #141419 0 50%) 0 0 / 12px 12px' }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.dataUrl} alt="" className="max-w-[90%] max-h-[80%] object-contain" />
          ) : (
            <Upload size={18} className="text-gray-500" />
          )}
        </span>
        <span className="min-w-0 text-sm">
          <strong className="block text-white font-medium truncate">{image ? image.name : `Upload ${zone.label.toLowerCase()}`}</strong>
          <span className="block text-gray-500 text-xs">
            {image ? formatFileSize(image.size) : `PNG with transparency, JPG or WebP, up to ${formatFileSize(c.upload.maxBytes)}`}
          </span>
        </span>
        <input ref={inputRef} type="file" accept={TYPES.join(',')} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>

      {error && (
        <p className="text-xs text-accent-red" role="alert">
          {error}
        </p>
      )}

      {image && (
        <>
          {c.scale.enabled && (
            <Slider
              id={`img-${zone.key}-scale`}
              label={`${zone.label} size`}
              value={r.scale}
              min={c.scale.min}
              max={c.scale.max}
              step={1}
              onChange={(scale) => onChange({ scale })}
              display={`${r.scale}%`}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {c.align.enabled && c.align.x.length > 1 && (
              <Segmented<Align> label={`${zone.label} horizontal alignment`} value={r.alignX} options={c.align.x} onChange={(alignX) => onChange({ alignX })} render={(a) => X_ICON[a]} />
            )}
            {c.align.enabled && c.align.y.length > 1 && (
              <Segmented<AlignY> label={`${zone.label} vertical alignment`} value={r.alignY} options={c.align.y} onChange={(alignY) => onChange({ alignY })} render={(a) => Y_ICON[a]} />
            )}
            <button type="button" onClick={() => onImage(null)} className="ml-auto text-xs text-gray-400 hover:text-white flex items-center gap-1">
              <X size={13} /> Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}
