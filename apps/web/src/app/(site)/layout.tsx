import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { WhatsAppButton } from '@/components/site/whatsapp-button';
import { getSite } from '@/lib/content';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  return (
    <>
      <a href="#main" className="focus:bg-primary focus:text-primary-foreground sr-only z-50 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:rounded-md focus:px-4 focus:py-2">
        Skip to content
      </a>
      <SiteHeader siteName={site.site.name} logoUrl={site.site.logoUrl} />
      <main id="main">{children}</main>
      <SiteFooter site={site} />
      <WhatsAppButton number={site.whatsapp.number} message={site.whatsapp.message} />
    </>
  );
}
