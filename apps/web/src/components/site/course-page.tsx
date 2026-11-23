import { CheckCircle2, Clock, GraduationCap, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getCourse, getFaqs, getPricing, getSite } from '@/lib/content';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { Container, coursePath, CtaBand, FaqSection, PricingTable, SectionHeading } from './sections';

export async function courseMetadata(slug: string): Promise<Metadata> {
  const course = await getCourse(slug);
  if (!course) return {};
  return pageMetadata({
    title: course.metaTitle ?? `${course.title} Online Classes`,
    description: course.metaDescription ?? course.shortDescription,
    path: coursePath(slug),
    image: course.imageUrl,
  });
}

/** Shared landing page for every course (dedicated SEO routes and /courses/[slug]). */
export async function CoursePage({ slug }: { slug: string }) {
  const [course, pricing, faqs, site] = await Promise.all([getCourse(slug), getPricing(), getFaqs(), getSite()]);
  if (!course) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.shortDescription,
    url: `${SITE_URL}${coursePath(slug)}`,
    provider: { '@type': 'EducationalOrganization', name: site.site.name, sameAs: SITE_URL },
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: `PT${course.classMinutes}M` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <section className="pattern-star bg-secondary/40 border-b">
        <Container className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <nav className="text-muted-foreground text-sm" aria-label="Breadcrumb">
              <Link href="/courses" className="hover:underline">Courses</Link> <span aria-hidden>/</span> <span>{course.title}</span>
            </nav>
            <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{course.title} online classes</h1>
            <p className="text-muted-foreground mt-5 text-lg">{course.shortDescription}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><Link href={`/free-trial?course=${course.slug}`}>Book a free trial</Link></Button>
              <Button size="lg" variant="outline" asChild><Link href={`/register?course=${course.slug}`}>Enroll now</Link></Button>
            </div>
          </div>
          <dl className="bg-card grid content-start gap-4 rounded-xl border p-6 shadow-xs">
            {[
              { icon: GraduationCap, label: 'Level', value: course.level },
              { icon: Users, label: 'Suitable for', value: course.ageGroup ?? 'All ages' },
              { icon: Clock, label: 'Class length', value: `${course.classMinutes} minutes, one-to-one` },
            ].map((r) => (
              <div key={r.label} className="flex items-start gap-3">
                <r.icon className="text-primary mt-0.5 size-5" aria-hidden />
                <div><dt className="text-muted-foreground text-xs">{r.label}</dt><dd className="font-medium">{r.value}</dd></div>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <section className="py-16">
        <Container className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-2xl font-bold">About this course</h2>
            <div className="prose-content">
              {(course.description ?? course.shortDescription).split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {course.lessons?.length ? (
              <>
                <h2 className="mt-10 text-2xl font-bold">Curriculum</h2>
                <ol className="mt-4 divide-y rounded-xl border">
                  {course.lessons.map((l) => (
                    <li key={l.id} className="flex gap-4 px-5 py-3.5">
                      <span className="text-primary w-6 shrink-0 font-semibold tabular-nums">{l.sortOrder}</span>
                      <div>
                        <p className="font-medium">{l.title}</p>
                        {l.summary ? <p className="text-muted-foreground text-sm">{l.summary}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </div>
          {course.outcomes?.length ? (
            <aside className="bg-secondary/50 h-fit rounded-xl p-6">
              <h2 className="font-semibold">What you will achieve</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-2"><CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />{o}</li>
                ))}
              </ul>
            </aside>
          ) : null}
        </Container>
      </section>

      <section className="bg-secondary/40 border-y py-16">
        <Container>
          <SectionHeading title="Plans for this course" description="Choose how many classes a week suit you. Your first class is free." />
          <div className="mt-10"><PricingTable plans={pricing} /></div>
        </Container>
      </section>

      <section className="py-16">
        <Container className="max-w-3xl">
          <SectionHeading title="Frequently asked questions" />
          <div className="mt-8"><FaqSection faqs={faqs.slice(0, 5)} /></div>
        </Container>
      </section>
      <CtaBand title={`Start ${course.title} today`} />
    </>
  );
}
