import type { BannerFontFace, TemplateConfig } from '@/lib/banner-overlay/types';

export type BannerTemplateStatus = 'none' | 'pending' | 'processing' | 'ready' | 'failed';

/** video: an MP4/MOV background, MP4 (+ GIF) results; image: a still background, PNG (+ JPG) results */
export type BannerKind = 'video' | 'image';
export type BannerFormat = 'mp4' | 'gif' | 'png' | 'jpg';

export interface VideoOutputs {
  mp4: true;
  gif: { enabled: boolean; width: number; fps: number };
}

export interface ImageOutputs {
  png: true;
  jpg: { enabled: boolean; quality: number };
}

/** Video templates have VideoOutputs, image templates ImageOutputs (see `kind`) */
export type BannerOutputs = VideoOutputs | ImageOutputs;

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
  /** Server-side ceilings for per-template settings */
  limits?: {
    custom_max_text: number;
    custom_max_images: number;
    max_zones?: number;
    max_image_zones?: number;
    text_max_length?: number;
  };
  uuid: string;
  slug: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  is_active: boolean;
  sort_order: number;
  kind: BannerKind;
  config: TemplateConfig;
  outputs: BannerOutputs;
  /** What an order produces, e.g. ['mp4', 'gif'] or ['png', 'jpg'] */
  formats: BannerFormat[];
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
  /** Missing in responses cached from before image templates: treat as video */
  kind?: BannerKind;
  width: number;
  height: number;
  /** null for image templates */
  duration: number | null;
  /** MP4 for video templates, a WebP still for image templates (watermarked either way) */
  preview_url: string;
  poster_url: string | null;
  outputs: BannerOutputs;
  formats?: BannerFormat[];
}

/** Everything the buyer editor needs (GET /banners/templates/{slug}) */
export interface PublicBannerTemplate extends PublicBannerTemplateCard {
  config: TemplateConfig;
  fonts: BannerFontFace[];
  fps: number | null;
  frame_count: number | null;
}

export type BannerOrderStatus = 'pending_payment' | 'queued' | 'rendering' | 'ready' | 'failed';

/** Buyer-facing order status (GET /banners/orders/{token}) */
export interface PublicBannerOrder {
  token: string;
  status: BannerOrderStatus;
  template: { name: string | null; slug: string | null };
  kind?: BannerKind;
  formats: BannerFormat[];
  email: string | null;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  files_expire_at: string | null;
  files_expired: boolean;
  downloads: Partial<Record<BannerFormat, string>> | null;
  /** Crypto payment the buyer picked last (or the one that paid); null before a coin is chosen */
  payment: PublicBannerPayment | null;
  server_time: string;
}

// ─── Crypto payments ──────────────────────────────────────────

export type BannerPaymentStatus = 'awaiting' | 'confirming' | 'underpaid' | 'paid' | 'review';

/** GET /banners/payments/availability */
export interface PaymentAvailability {
  payments_available: boolean;
  auto_approve: boolean;
  price_lock_minutes: number;
}

/** One entry of the coin/network picker (GET /banners/orders/{token}/payment-methods) */
export interface PaymentMethod {
  key: string;
  coin: string;
  coin_name: string;
  network: string;
  network_name: string;
  /** File name in /public/crypto (without .svg) */
  icon: string;
  /** File name in /public/crypto/networks, null = use the coin icon */
  network_icon: string | null;
  decimals: number;
  requires_tag: boolean;
  approx_amount: string | null;
  available: boolean;
  unavailable_reason: string | null;
}

export interface PaymentMethodsResponse {
  available: boolean;
  reason: 'not_configured' | 'unavailable' | 'not_pending' | null;
  methods: PaymentMethod[];
  price_lock_minutes?: number;
}

/** Deposit address and quote (POST /banners/orders/{token}/payment, and `payment` in the order) */
export interface PublicBannerPayment {
  method: string;
  coin: string;
  coin_name: string;
  network: string;
  network_name: string;
  icon: string;
  network_icon: string | null;
  address: string;
  dest_tag: string | null;
  /** Coin amounts are decimal strings */
  amount: string;
  amount_usd: string;
  received: string;
  pending: string;
  remaining: string;
  confirmations: number;
  status: BannerPaymentStatus;
  expires_at: string | null;
  /** The price lock ran out and nothing has arrived: ask for a new quote */
  expired: boolean;
  paid_at: string | null;
}

export interface AdminBannerPaymentTransaction {
  provider_id: string;
  currency: string;
  amount: string;
  status: 'pending' | 'completed' | 'failed';
  provider_status: string | null;
  confirmations: number;
  hash: string | null;
  first_seen_at: string | null;
  completed_at: string | null;
}

export interface AdminBannerPayment extends PublicBannerPayment {
  id: number;
  provider: string;
  currency: string;
  label: string;
  rate: string;
  quoted_at: string | null;
  selected_at: string | null;
  detected_at: string | null;
  last_checked_at: string | null;
  overpaid: string | null;
  review_reason: 'late' | 'late_short' | null;
  late_value_usd: number | null;
  order_already_paid: boolean;
  transactions: AdminBannerPaymentTransaction[];
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
  payment_reference: string | null;
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
    kind: BannerKind;
    template: { id: number; slug: string; name: string; price: string; currency: string };
    config: TemplateConfig;
    outputs: BannerOutputs;
    media: { width: number; height: number; fps: number | null; duration: number | null; frame_count: number | null; source_rev: number };
    fonts: BannerFontFace[];
  };
  preview_url: string | null;
  images: Record<string, string>;
  result: {
    timings: Record<string, number> | null;
    fit: Record<string, unknown> | null;
    mp4_size: number | null;
    gif_size: number | null;
    png_size?: number | null;
    jpg_size?: number | null;
  } | null;
  render_log: string | null;
  downloads: Partial<Record<BannerFormat, string>> | null;
  ip: string | null;
  payments: AdminBannerPayment[];
}
