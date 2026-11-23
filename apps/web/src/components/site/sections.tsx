import { ArrowRight, BookOpen, CalendarCheck, Check, GraduationCap, Quote, Star, Users, Video } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { CmsSection, Faq, PricingPlan, PublicCourse, PublicTeacher, Testimonial } from '@/lib/content';
import { cn, formatMoney } from '@/lib/utils';
import { FaqAccordion } from './faq-accordion';

/** Courses with their own SEO landing page at the site root. */
export const DEDICATED_COURSE_PATHS = new Set(['noorani-qaida', 'quran-reading', 'quran-memorization', 'tajweed', 'islamic-studies', 'kids-quran-classes']);
export const coursePath = (slug: string) => (DEDICATED_COURSE_PATHS.has(slug) ? `/${slug}` : `/courses/${slug}`);

export function Container({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-auto max-w-7xl px-4 sm:px-6', className)} {...props} />;
}

export function SectionHeading({ eyebrow, title, description, center = true }: { eyebrow?: string; title: string; description?: string; center?: boolean }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      {eyebrow ? <p className="text-primary text-sm font-semibold tracking-wide uppercase">{eyebrow}</p> : null}
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
      {description ? <p className="text-muted-foreground mt-4 text-lg">{description}</p> : null}
    </div>
  );
}

export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <section className="pattern-star bg-secondary/40 border-b">
      <Container className="py-14 sm:py-20">
        <div className="max-w-3xl">
          {eyebrow ? <p className="text-primary text-sm font-semibold tracking-wide uppercase">{eyebrow}</p> : null}
          <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{title}</h1>
          {description ? <p className="text-muted-foreground mt-5 text-lg">{description}</p> : null}
          {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
        </div>
      </Container>
    </section>
  );
}

const CATEGORY_ICON: Record<string, React.ElementType> = {
  NOORANI_QAIDA: BookOpen,
  QURAN_READING: BookOpen,
  QURAN_MEMORIZATION: GraduationCap,
  TAJWEED: Video,
  ISLAMIC_STUDIES: Star,
  KIDS: Users,
};

export function CourseCard({ course }: { course: PublicCourse }) {
  const Icon = CATEGORY_ICON[course.category] ?? BookOpen;
  return (
    <Link href={coursePath(course.slug)} className="group bg-card hover:border-primary/40 flex flex-col rounded-xl border p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="bg-secondary text-primary flex size-11 items-center justify-center rounded-lg">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-5 text-lg font-semibold">{course.title}</h3>
      <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">{course.shortDescription}</p>
      <div className="text-muted-foreground mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>{course.level}</span>
        {course.ageGroup ? <span>{course.ageGroup}</span> : null}
        <span>{course.classMinutes} min classes</span>
      </div>
      <span className="text-primary mt-5 inline-flex items-center gap-1 text-sm font-medium">
        Learn more <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

export function PricingTable({ plans }: { plans: PricingPlan[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((p) => (
        <div key={p.id} className={cn('bg-card relative flex flex-col rounded-2xl border p-7 shadow-xs', p.isHighlighted && 'border-primary ring-primary/20 shadow-lg ring-4')}>
          {p.isHighlighted ? <span className="bg-gold absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-semibold text-[oklch(0.25_0.04_70)]">Most popular</span> : null}
          <h3 className="text-lg font-semibold">{p.name}</h3>
          {p.description ? <p className="text-muted-foreground mt-1 text-sm">{p.description}</p> : null}
          <p className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold">{formatMoney(p.priceMonthly, p.currency)}</span>
            <span className="text-muted-foreground text-sm">/ month</span>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">{p.classesPerWeek} classes a week · {p.classMinutes} minutes each</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            {p.features.map((f) => (
              <li key={f} className="flex gap-2"><Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />{f}</li>
            ))}
          </ul>
          <Button className="mt-8" variant={p.isHighlighted ? 'default' : 'outline'} asChild>
            <Link href="/free-trial">Start with a free trial</Link>
          </Button>
        </div>
      ))}
    </div>
  );
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {items.map((t) => (
        <figure key={t.id} className="bg-card flex flex-col rounded-xl border p-6 shadow-xs">
          <Quote className="text-gold size-7" aria-hidden />
          <div className="mt-3 flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={cn('size-4', i < t.rating ? 'fill-gold text-gold' : 'text-border')} aria-hidden />
            ))}
          </div>
          <blockquote className="mt-4 flex-1 leading-relaxed">“{t.quote}”</blockquote>
          <figcaption className="mt-6 text-sm">
            <span className="font-semibold">{t.name}</span>
            <span className="text-muted-foreground block">{[t.role, t.location].filter(Boolean).join(' · ')}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function TeacherCard({ teacher }: { teacher: PublicTeacher }) {
  return (
    <article className="bg-card flex flex-col rounded-xl border p-6 shadow-xs">
      <div className="flex items-center gap-4">
        {teacher.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teacher.avatarUrl} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <div className="bg-secondary text-primary flex size-16 items-center justify-center rounded-full text-lg font-semibold">
            {teacher.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </div>
        )}
        <div>
          <h3 className="font-semibold">{teacher.fullName}</h3>
          <p className="text-muted-foreground text-sm">{teacher.experienceYears}+ years teaching</p>
        </div>
      </div>
      {teacher.bio ? <p className="text-muted-foreground mt-4 text-sm leading-relaxed">{teacher.bio}</p> : null}
      <dl className="mt-4 space-y-1.5 text-sm">
        {teacher.specialties.length ? <div><dt className="inline font-medium">Specialties: </dt><dd className="text-muted-foreground inline">{teacher.specialties.join(', ')}</dd></div> : null}
        <div><dt className="inline font-medium">Languages: </dt><dd className="text-muted-foreground inline">{teacher.languages.join(', ')}</dd></div>
        {teacher.certifications.length ? <div><dt className="inline font-medium">Certifications: </dt><dd className="text-muted-foreground inline">{teacher.certifications.join(', ')}</dd></div> : null}
      </dl>
    </article>
  );
}

export function HowItWorks() {
  const steps = [
    { icon: CalendarCheck, title: 'Book a free trial', body: 'Tell us your goals, level and preferred times in your own time zone.' },
    { icon: Users, title: 'Meet your teacher', body: 'We match you with a qualified male or female teacher for a free assessment class.' },
    { icon: Video, title: 'Learn live, one-to-one', body: 'Join from any device. Every class is recorded so you can revise later.' },
    { icon: GraduationCap, title: 'Track your progress', body: 'Homework, attendance and ayah-by-ayah progress — visible to students and parents.' },
  ];
  return (
    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="relative rounded-xl border bg-card p-6 shadow-xs">
          <span className="text-muted-foreground absolute top-5 right-5 text-sm font-semibold">0{i + 1}</span>
          <s.icon className="text-primary size-7" aria-hidden />
          <h3 className="mt-4 font-semibold">{s.title}</h3>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function CtaBand({ title = 'Begin your Quran journey today', body = 'Your first class is free. No payment details needed.' }: { title?: string; body?: string }) {
  return (
    <section className="py-16">
      <Container>
        <div className="bg-primary text-primary-foreground pattern-star relative overflow-hidden rounded-2xl px-6 py-12 text-center sm:px-12">
          <h2 className="text-3xl font-bold">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl opacity-90">{body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="gold" asChild><Link href="/free-trial">Book your free trial</Link></Button>
            <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  return <FaqAccordion faqs={faqs} />;
}

/** Renders CMS section blocks. Unknown block types are skipped so the CMS can evolve safely. */
export function CmsSections({ sections }: { sections: CmsSection[] }) {
  return (
    <div className="prose-content max-w-3xl">
      {sections.map((s, i) => {
        if (s.type === 'richText') {
          return (
            <section key={i}>
              {s.heading ? <h2>{s.heading}</h2> : null}
              {s.body?.split(/\n{2,}/).map((para, j) => <p key={j}>{para}</p>)}
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}
