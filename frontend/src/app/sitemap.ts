import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { fetchBannerTemplates } from '@/lib/banners-server';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
    { path: '', priority: 1, changeFrequency: 'weekly' },
    { path: '/portfolio', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/banners', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/get-started', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  ];

  // Banner template pages (skipped if the API is unreachable at generation time)
  const templates = (await fetchBannerTemplates()) || [];
  for (const t of templates) routes.push({ path: `/banners/${t.slug}`, priority: 0.8, changeFrequency: 'weekly' });

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
