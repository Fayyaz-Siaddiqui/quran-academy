import type { MetadataRoute } from 'next';
import { coursePath } from '@/components/site/sections';
import { getBlog, getCourses } from '@/lib/content';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, posts] = await Promise.all([getCourses(), getBlog()]);
  const now = new Date();
  const staticPaths: [string, number][] = [
    ['/', 1],
    ['/courses', 0.9],
    ['/free-trial', 0.9],
    ['/pricing', 0.8],
    ['/teachers', 0.7],
    ['/about', 0.6],
    ['/faqs', 0.6],
    ['/contact', 0.6],
    ['/blog', 0.6],
    ['/register', 0.5],
    ['/privacy-policy', 0.2],
    ['/terms-and-conditions', 0.2],
  ];
  return [
    ...staticPaths.map(([path, priority]) => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency: 'weekly' as const, priority })),
    ...courses.map((c) => ({ url: `${SITE_URL}${coursePath(c.slug)}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.85 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: new Date(p.publishedAt), changeFrequency: 'yearly' as const, priority: 0.5 })),
  ];
}
