import React from 'react';
import type { AdminBannerTemplate } from '@/types/banners';

/** Processing state of the template video, as a small pill. */
export default function TemplateStatusBadge({ template }: { template: Pick<AdminBannerTemplate, 'processing_status' | 'has_media' | 'processing_error'> }) {
  const { processing_status: status, has_media: hasMedia, processing_error: error } = template;

  let label = 'No video';
  let cls = 'bg-white/5 text-gray-400';
  if (status === 'pending' || status === 'processing') {
    label = status === 'pending' ? 'Queued' : 'Processing';
    cls = 'bg-amber-400/10 text-amber-300';
  } else if (status === 'failed') {
    label = 'Failed';
    cls = 'bg-red-400/10 text-red-400';
  } else if (hasMedia) {
    label = error ? 'Ready (last upload failed)' : 'Ready';
    cls = error ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300';
  }

  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}
