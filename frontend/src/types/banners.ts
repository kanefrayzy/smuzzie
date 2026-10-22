import type { BannerFontFace, TemplateConfig } from '@/lib/banner-overlay/types';

export type BannerTemplateStatus = 'none' | 'pending' | 'processing' | 'ready' | 'failed';

export interface BannerOutputs {
  mp4: true;
  gif: { enabled: boolean; width: number; fps: number };
}

export interface BannerWatermark {
  text: string;
  /** 0-255 */
  opacity: number;
}

export interface AdminBannerFont extends BannerFontFace {
  uuid: string;
  file_size: number;
  created_at: string;
  templates: { id: number; name: string }[];
}

export interface AdminBannerTemplate {
  id: number;
  uuid: string;
  slug: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  is_active: boolean;
  sort_order: number;
  config: TemplateConfig;
  outputs: BannerOutputs;
  watermark: BannerWatermark;
  source_rev: number;
  width: number | null;
  height: number | null;
  frame_count: number | null;
  duration: number | null;
  fps: number | null;
  processing_status: BannerTemplateStatus;
  processing_error: string | null;
  processed_at: string | null;
  preview_url: string | null;
  poster_url: string | null;
  has_media: boolean;
  is_processing: boolean;
  orders_count?: number;
  created_at: string;
  updated_at: string;
}

/** Catalog card (GET /banners/templates) */
export interface PublicBannerTemplateCard {
  slug: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  width: number;
  height: number;
  duration: number;
  preview_url: string;
  poster_url: string | null;
  outputs: BannerOutputs;
}

/** Everything the buyer editor needs (GET /banners/templates/{slug}) */
export interface PublicBannerTemplate extends PublicBannerTemplateCard {
  config: TemplateConfig;
  fonts: BannerFontFace[];
  fps: number;
  frame_count: number;
}

export type BannerOrderStatus = 'pending_payment' | 'queued' | 'rendering' | 'ready' | 'failed';

/** Buyer-facing order status (GET /banners/orders/{token}) */
export interface PublicBannerOrder {
  token: string;
  status: BannerOrderStatus;
  template: { name: string | null; slug: string | null };
  formats: ('mp4' | 'gif')[];
  email: string | null;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  files_expire_at: string | null;
  files_expired: boolean;
  downloads: Partial<Record<'mp4' | 'gif', string>> | null;
}

export interface AdminBannerOrder {
  id: number;
  token: string;
  status: BannerOrderStatus;
  is_test: boolean;
  email: string | null;
  template: { id: number | null; name: string | null; slug: string | null };
  amount: string;
  currency: string;
  payment_provider: string | null;
  attempts: number;
  error: string | null;
  created_at: string;
  paid_at: string | null;
  queued_at: string | null;
  rendering_started_at: string | null;
  ready_at: string | null;
  failed_at: string | null;
  notified_at: string | null;
  result_purged_at: string | null;
}

export interface AdminBannerOrderDetails extends AdminBannerOrder {
  params: import('@/lib/banner-overlay/types').BuyerParams;
  snapshot: {
    snapshotVersion: number;
    template: { id: number; slug: string; name: string; price: string; currency: string };
    config: TemplateConfig;
    outputs: BannerOutputs;
    media: { width: number; height: number; fps: number; duration: number; frame_count: number; source_rev: number };
    fonts: BannerFontFace[];
  };
  preview_url: string | null;
  images: Record<string, string>;
  result: { timings: Record<string, number> | null; fit: Record<string, unknown> | null; mp4_size: number | null; gif_size: number | null } | null;
  render_log: string | null;
  downloads: Partial<Record<'mp4' | 'gif', string>> | null;
  ip: string | null;
}
