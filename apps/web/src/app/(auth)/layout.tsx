import type { Metadata } from 'next';
import { Logo } from '@/components/site/logo';
import { getSite } from '@/lib/content';

export const metadata: Metadata = { robots: { index: true, follow: true } };

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,680px)]">
      <aside className="bg-sidebar text-sidebar-foreground pattern-star relative hidden flex-col justify-between p-10 lg:flex">
        <Logo name={site.site.name} light />
        <div>
          <p className="font-arabic text-gold text-4xl leading-loose" lang="ar" dir="rtl">خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ</p>
          <p className="mt-3 max-w-md opacity-80">“The best of you are those who learn the Quran and teach it.” — Sahih al-Bukhari</p>
        </div>
        <p className="text-xs opacity-60">© {new Date().getFullYear()} {site.site.name}</p>
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-10">
        <div className="lg:hidden"><Logo name={site.site.name} /></div>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
