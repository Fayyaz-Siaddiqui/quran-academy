import { CalendarCheck, CheckCircle2, ShieldCheck } from 'lucide-react';
import { FreeTrialForm } from '@/components/forms/free-trial-form';
import { Container, PageHero } from '@/components/site/sections';
import { getCourses } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Book a Free Trial Quran Class',
  description: 'Book a free one-to-one trial class with a qualified Quran teacher at a time that suits your time zone.',
  path: '/free-trial',
});

type Props = { searchParams: Promise<{ course?: string }> };

export default async function FreeTrialPage({ searchParams }: Props) {
  const [{ course }, courses] = await Promise.all([searchParams, getCourses()]);
  return (
    <>
      <PageHero eyebrow="Free trial" title="Book your free trial class" description="A 30-minute one-to-one class including a level assessment. No payment details required." />
      <section className="py-14">
        <Container className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <FreeTrialForm courses={courses.map((c) => ({ slug: c.slug, title: c.title }))} defaultCourse={course} />
          <aside className="space-y-4">
            {[
              { icon: CalendarCheck, title: 'Your time zone', body: 'Choose a time in your local time — we handle the conversion for your teacher.' },
              { icon: CheckCircle2, title: 'Level assessment', body: 'Your teacher assesses reading and recommends the right course and pace.' },
              { icon: ShieldCheck, title: 'No obligation', body: 'Enrol only if you are happy with your teacher.' },
            ].map((b) => (
              <div key={b.title} className="bg-secondary/50 flex gap-4 rounded-xl p-5">
                <b.icon className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
                <div><h2 className="font-semibold">{b.title}</h2><p className="text-muted-foreground mt-1 text-sm">{b.body}</p></div>
              </div>
            ))}
          </aside>
        </Container>
      </section>
    </>
  );
}
