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
