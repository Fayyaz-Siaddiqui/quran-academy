import { BookOpenCheck, HeartHandshake, ShieldCheck } from 'lucide-react';
import { CmsSections, Container, CtaBand, PageHero } from '@/components/site/sections';
import { getPage, getSite } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata() {
  const page = await getPage('about');
  return pageMetadata({ title: page?.metaTitle ?? 'About Us', description: page?.metaDescription ?? 'Who we are and how we teach.', path: '/about', image: page?.ogImageUrl });
}

export default async function AboutPage() {
  const [page, site] = await Promise.all([getPage('about'), getSite()]);
  return (
    <>
      <PageHero eyebrow="About us" title={`About ${site.site.name}`} description={site.site.tagline} />
      <section className="py-16">
        <Container className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          {page ? <CmsSections sections={page.sections} /> : null}
          <ul className="space-y-4">
            {[
              { icon: BookOpenCheck, title: 'Authentic knowledge', body: 'Teachers with ijazah and formal Islamic education.' },
              { icon: ShieldCheck, title: 'Safe for children', body: 'Vetted teachers, recorded classes and full parent visibility.' },
              { icon: HeartHandshake, title: 'Personal attention', body: 'One-to-one classes tailored to each learner.' },
            ].map((v) => (
              <li key={v.title} className="bg-card flex gap-4 rounded-xl border p-5 shadow-xs">
                <v.icon className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
                <div><h2 className="font-semibold">{v.title}</h2><p className="text-muted-foreground mt-1 text-sm">{v.body}</p></div>
              </li>
            ))}
          </ul>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
