import type { Metadata } from 'next';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Per-page metadata with canonical URL and Open Graph. */
export function pageMetadata({ title, description, path, image }: { title: string; description: string; path: string; image?: string | null }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: `${SITE_URL}${path}`, type: 'website', ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** Pages behind login must never be indexed. */
export const NO_INDEX: Metadata = { robots: { index: false, follow: false } };
