import type { Metadata, Viewport } from 'next';
import { Amiri, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import { getSite } from '@/lib/content';
import { SITE_URL } from '@/lib/seo';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });
const amiri = Amiri({ subsets: ['arabic', 'latin'], weight: ['400', '700'], variable: '--font-amiri', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: site.seo.defaultTitle, template: `%s | ${site.site.name}` },
    description: site.seo.defaultDescription,
    applicationName: site.site.name,
    openGraph: {
      type: 'website',
      siteName: site.site.name,
      title: site.seo.defaultTitle,
      description: site.seo.defaultDescription,
      url: SITE_URL,
      locale: 'en_GB',
    },
    twitter: { card: 'summary_large_image', title: site.seo.defaultTitle, description: site.seo.defaultDescription },
    alternates: { canonical: '/' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1b1c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${amiri.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
