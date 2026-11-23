import { Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import type { SiteSettings } from '@/lib/content';
import { Logo } from './logo';

const COLUMNS = [
  {
    title: 'Courses',
    links: [
      { href: '/noorani-qaida', label: 'Noorani Qaida' },
      { href: '/quran-reading', label: 'Quran Reading' },
      { href: '/quran-memorization', label: 'Quran Memorization' },
      { href: '/tajweed', label: 'Tajweed' },
      { href: '/islamic-studies', label: 'Islamic Studies' },
      { href: '/kids-quran-classes', label: 'Kids Quran Classes' },
    ],
  },
  {
    title: 'Academy',
    links: [
      { href: '/about', label: 'About us' },
      { href: '/teachers', label: 'Our teachers' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/blog', label: 'Blog' },
      { href: '/faqs', label: 'FAQs' },
      { href: '/register?type=teacher', label: 'Teach with us' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { href: '/free-trial', label: 'Book a free trial' },
      { href: '/register', label: 'Create an account' },
      { href: '/login', label: 'Log in' },
      { href: '/contact', label: 'Contact us' },
    ],
  },
];

const SOCIAL_LABELS: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', x: 'X' };

export function SiteFooter({ site }: { site: SiteSettings }) {
  // Only absolute http(s) links from the CMS are rendered.
  const socials = Object.entries(site.social ?? {}).filter(([, url]) => typeof url === 'string' && /^https?:\/\//.test(url));
  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo name={site.site.name} logoUrl={site.site.logoUrl} light />
          <p className="mt-4 max-w-sm text-sm opacity-80">{site.site.tagline}</p>
          {socials.length ? (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {socials.map(([key, url]) => (
                <li key={key}><a href={url} target="_blank" rel="noopener noreferrer" className="opacity-80 hover:underline hover:opacity-100">{SOCIAL_LABELS[key] ?? key}</a></li>
              ))}
            </ul>
          ) : null}
          <ul className="mt-6 space-y-2 text-sm opacity-90">
            <li className="flex items-center gap-2"><Mail className="size-4" aria-hidden /> <a href={`mailto:${site.contact.email}`} className="hover:underline">{site.contact.email}</a></li>
            <li className="flex items-center gap-2"><Phone className="size-4" aria-hidden /> <a href={`tel:${site.contact.phone.replace(/\s/g, '')}`} className="hover:underline">{site.contact.phone}</a></li>
            <li className="flex items-center gap-2"><MapPin className="size-4" aria-hidden /> {site.contact.address}</li>
          </ul>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold text-white">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.href}><Link href={l.href} className="opacity-80 transition-opacity hover:opacity-100">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs opacity-70 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} {site.site.name}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
            <Link href="/terms-and-conditions" className="hover:underline">Terms and Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
