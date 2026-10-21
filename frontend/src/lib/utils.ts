import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) return 'N/A';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Normalize image URLs from the backend.
 * Handles cases where APP_URL might not include the port,
 * or where the URL is a relative path.
 */
export function getImageUrl(url: string | null | undefined): string {
  if (!url) return 'https://placehold.co/400x300/1a1a1a/333?text=No+Image';
  
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1')
    .replace(/\/api\/v1$/, '');
  
  // If the URL is a relative path like /storage/...
  if (url.startsWith('/storage/')) {
    return `${backendUrl}${url}`;
  }
  
  // If URL points to localhost without port (old entries), fix it
  if (url.startsWith('http://localhost/storage/')) {
    return url.replace('http://localhost/storage/', `${backendUrl}/storage/`);
  }
  
  // If URL is just a path like storage/...
  if (url.startsWith('storage/')) {
    return `${backendUrl}/${url}`;
  }

  // If URL has a different backend host, rewrite to current backend
  if (url.includes('/storage/')) {
    const storagePath = url.split('/storage/').pop() || '';
    if (storagePath) {
      return `${backendUrl}/storage/${storagePath}`;
    }
  }
  
  return url;
}

/** True for http(s) URLs (e.g. a review avatar that is a link, not an emoji). */
export function isImageUrl(value: string | null | undefined): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

/** True when a URL points at a video file rather than an image. */
export function isVideoUrl(url: string | null | undefined): boolean {
  return !!url && /\.(mp4|webm)(\?|#|$)/i.test(url);
}

/**
 * Human-readable message from a Laravel API error.
 * The backend returns {message}, {error} or {errors: {field: [msg]}} depending on the case.
 */
export function getApiError(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data.message === 'string' && data.message) return data.message;
  if (typeof data.error === 'string' && data.error) return data.error;
  if (data.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors).flat()[0];
    if (typeof first === 'string') return first;
  }
  return fallback;
}
