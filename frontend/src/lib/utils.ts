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
  
  // If it's already a full URL with the correct backend port, return as-is
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1')
    .replace(/\/api\/v1$/, '');
  
  // Extract the storage path and route through /media/ for cache headers
  let storagePath = '';

  if (url.startsWith('/storage/')) {
    storagePath = url.replace('/storage/', '');
  } else if (url.startsWith('http://localhost/storage/')) {
    storagePath = url.replace('http://localhost/storage/', '');
  } else if (url.startsWith('storage/')) {
    storagePath = url.replace('storage/', '');
  } else if (url.includes('/storage/')) {
    storagePath = url.split('/storage/').pop() || '';
  }

  if (storagePath) {
    return `${backendUrl}/media/${storagePath}`;
  }

  return url;
}
