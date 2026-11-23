import { CheckCircle2, Clock, Globe2, PlayCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import {
  Container,
  CourseCard,
  CtaBand,
  FaqSection,
  HowItWorks,
  PricingTable,
  SectionHeading,
  Testimonials,
} from '@/components/site/sections';
import { Button } from '@/components/ui/button';
import { getCourses, getFaqs, getPricing, getSite, getTestimonials } from '@/lib/content';
import { SITE_URL } from '@/lib/seo';

export default async function HomePage() {
  const [site, courses, pricing, testimonials, faqs] = await Promise.all([getSite(), getCourses(), getPricing(), getTestimonials(), getFaqs()]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: site.site.name,
    url: SITE_URL,
    description: site.seo.defaultDescription,
    email: site.contact.email,
    telephone: site.contact.phone,
    areaServed: ['US', 'GB', 'CA', 'AE', 'SA', 'AU', 'EU'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Online Quran courses',
      itemListElement: courses.map((c) => ({ '@type': 'Course', name: c.title, description: c.shortDescription, provider: { '@type': 'Organization', name: site.site.name } })),
    },
  };

  return (
    <>
      {/* CMS text is escaped so a "</script>" in content cannot break out of the tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      {/* Hero */}
      <section className="pattern-star relative overflow-hidden border-b">
        <div className="from-background via-background/90 absolute inset-0 bg-gradient-to-r to-transparent" aria-hidden />
        <Container className="relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
              <Globe2 className="size-3.5" aria-hidden /> Classes in every time zone · US · UK · Canada · Gulf · Australia · Europe
            </p>
            <h1 className="mt-6 text-4xl leading-[1.1] font-bold sm:text-5xl lg:text-6xl">{site.home.heroTitle}</h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg">{site.home.heroSubtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" asChild><Link href="/free-trial">Book a free trial class</Link></Button>
              <Button size="lg" variant="outline" asChild><Link href="/courses"><PlayCircle /> Explore courses</Link></Button>
            </div>
            <ul className="text-muted-foreground mt-8 grid gap-2 text-sm sm:grid-cols-2">
              {['Male & female teachers', 'One-to-one live classes', 'Every class recorded', 'Parent progress portal'].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 className="text-primary size-4" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="bg-card relative rounded-2xl border p-8 shadow-xl">
              <p className="font-arabic text-primary text-center text-4xl leading-loose sm:text-5xl" lang="ar" dir="rtl">
                ﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾
              </p>
              <p className="text-muted-foreground mt-3 text-center text-sm italic">“And recite the Quran with measured recitation.” — Al-Muzzammil 73:4</p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {site.home.stats.map((s) => (
                  <div key={s.label} className="bg-secondary/60 rounded-lg p-4 text-center">
                    <p className="text-primary text-2xl font-bold">{s.value}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Trust strip */}
      <section className="border-b">
        <Container className="grid gap-6 py-8 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Vetted, certified teachers', body: 'Ijazah holders and experienced tutors, approved by our academic team.' },
            { icon: Clock, title: 'Flexible scheduling', body: 'Mornings, evenings and weekends — scheduled in your local time.' },
            { icon: Globe2, title: 'Learn from anywhere', body: 'Join from a laptop, tablet or phone. No downloads required.' },
          ].map((f) => (
            <div key={f.title} className="flex gap-4">
              <f.icon className="text-primary mt-1 size-6 shrink-0" aria-hidden />
              <div>
                <h2 className="font-semibold">{f.title}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{f.body}</p>
              </div>
            </div>
          ))}
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <SectionHeading eyebrow="Courses" title="A path for every learner" description="From the first Arabic letter to completing Hifz — structured courses for children and adults." />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </Container>
      </section>

      <section className="bg-secondary/40 border-y py-20">
        <Container>
          <SectionHeading eyebrow="How it works" title="Start learning in four simple steps" />
          <div className="mt-12"><HowItWorks /></div>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <SectionHeading eyebrow="Testimonials" title="Trusted by families around the world" />
          <div className="mt-12"><Testimonials items={testimonials} /></div>
        </Container>
      </section>

      <section className="bg-secondary/40 border-y py-20">
        <Container>
          <SectionHeading eyebrow="Pricing" title="Simple monthly plans" description="All plans include one-to-one classes, recordings and progress tracking. Cancel anytime." />
          <div className="mt-12"><PricingTable plans={pricing} /></div>
        </Container>
      </section>

      <section className="py-20">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="FAQs" title="Questions parents and students ask" />
          <div className="mt-10"><FaqSection faqs={faqs.slice(0, 6)} /></div>
          <p className="mt-6 text-center text-sm">
            <Link href="/faqs" className="text-primary font-medium hover:underline">See all FAQs</Link>
          </p>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
