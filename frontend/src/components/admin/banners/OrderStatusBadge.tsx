import React from 'react';
import type { BannerOrderStatus } from '@/types/banners';

export const ORDER_STATUS_LABELS: Record<BannerOrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  queued: 'Queued',
  rendering: 'Rendering',
  ready: 'Ready',
  failed: 'Failed',
};

const CLASSES: Record<BannerOrderStatus, string> = {
  pending_payment: 'bg-white/5 text-gray-300',
  queued: 'bg-sky-400/10 text-sky-300',
  rendering: 'bg-amber-400/10 text-amber-300',
  ready: 'bg-emerald-400/10 text-emerald-300',
  failed: 'bg-red-400/10 text-red-400',
};

export default function OrderStatusBadge({ status }: { status: BannerOrderStatus }) {
  return <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${CLASSES[status]}`}>{ORDER_STATUS_LABELS[status]}</span>;
}
