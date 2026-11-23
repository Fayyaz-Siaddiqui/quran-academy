import { FALLBACK } from './fallback-content';

/**
 * Server-side fetchers for public website content (CMS).
 * Responses are cached and revalidated every 5 minutes; if the API is
 * unreachable (e.g. during a static build), bundled defaults are used so the
 * marketing site never renders blank.
 */

// Server-side fetches need an absolute URL even when the browser uses the same-origin proxy.
const API = `${(process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`;
const ACADEMY = process.env.NEXT_PUBLIC_ACADEMY_SLUG;

async function get<T>(path: string, fallback: T, revalidate = 300): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, {
      next: { revalidate, tags: ['cms'] },
      headers: ACADEMY ? { 'X-Academy': ACADEMY } : undefined,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export interface SiteSettings {
  site: { name: string; tagline: string; logoUrl: string | null };
  contact: { email: string; phone: string; address: string; hours: string };
  whatsapp: { number: string; message: string };
  social: Record<string, string>;
  seo: { defaultTitle: string; defaultDescription: string };
  home: { heroTitle: string; heroSubtitle: string; stats: { label: string; value: string }[] };
}

export interface PublicCourse {
  id: string;
  slug: string;
  title: string;
  category: string;
  level: string;
  shortDescription: string;
  description?: string;
  outcomes?: string[];
  ageGroup: string | null;
  durationWeeks: number | null;
  classMinutes: number;
  imageUrl: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  lessons?: { id: string; title: string; summary: string | null; sortOrder: number }[];
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  priceMonthly: number;
  classesPerWeek: number;
  classMinutes: number;
  features: string[];
  isHighlighted: boolean;
}

export interface Testimonial { id: string; name: string; location: string | null; role: string | null; quote: string; rating: number }
export interface Faq { id: string; category: string; question: string; answer: string }
export interface PublicTeacher {
  id: string; fullName: string; country: string | null; bio: string | null; experienceYears: number;
  languages: string[]; certifications: string[]; specialties: string[]; avatarUrl: string | null;
}
export interface BlogSummary { id: string; slug: string; title: string; excerpt: string; coverImageUrl: string | null; tags: string[]; publishedAt: string; author: { fullName: string } | null }
export interface BlogPost extends BlogSummary { content: string; metaTitle: string | null; metaDescription: string | null }
export interface CmsSection { type: string; heading?: string; body?: string }
export interface CmsPage { slug: string; title: string; metaTitle: string | null; metaDescription: string | null; ogImageUrl: string | null; sections: CmsSection[]; updatedAt?: string }

export async function getSite(): Promise<SiteSettings> {
  const data = await get<Partial<SiteSettings>>('/public/site', {});
  return { ...FALLBACK.site, ...data } as SiteSettings;
}
export const getCourses = () => get<PublicCourse[]>('/public/courses', FALLBACK.courses);
export async function getCourse(slug: string): Promise<PublicCourse | null> {
  const fallback = FALLBACK.courses.find((c) => c.slug === slug) ?? null;
  return get<PublicCourse | null>(`/public/courses/${encodeURIComponent(slug)}`, fallback);
}
export const getPricing = () => get<PricingPlan[]>('/public/pricing', FALLBACK.pricing);
export const getTestimonials = () => get<Testimonial[]>('/public/testimonials', FALLBACK.testimonials);
export const getFaqs = () => get<Faq[]>('/public/faqs', FALLBACK.faqs);
export const getPublicTeachers = () => get<PublicTeacher[]>('/teachers/public', [], 600);
export const getBlog = () => get<BlogSummary[]>('/public/blog', []);
export const getBlogPost = (slug: string) => get<BlogPost | null>(`/public/blog/${encodeURIComponent(slug)}`, null);
export async function getPage(slug: string): Promise<CmsPage | null> {
  return get<CmsPage | null>(`/public/pages/${encodeURIComponent(slug)}`, FALLBACK.pages[slug] ?? null);
}
