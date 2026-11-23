import Link from 'next/link';
import { Container, CtaBand, PageHero, TeacherCard } from '@/components/site/sections';
import { Button } from '@/components/ui/button';
import { getPublicTeachers } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Our Quran Teachers',
  description: 'Meet our qualified male and female Quran and Tajweed teachers — ijazah holders with years of online teaching experience.',
  path: '/teachers',
});

export default async function TeachersPage() {
  const teachers = await getPublicTeachers();
  return (
    <>
      <PageHero eyebrow="Faculty" title="Qualified, caring Quran teachers" description="Every teacher is interviewed, assessed for recitation and tajweed, and approved by our academic team before teaching.">
        <Button asChild><Link href="/free-trial">Request a teacher</Link></Button>
        <Button variant="outline" asChild><Link href="/register?type=teacher">Apply to teach</Link></Button>
      </PageHero>
      <section className="py-16">
        <Container>
          {teachers.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{teachers.map((t) => <TeacherCard key={t.id} teacher={t} />)}</div>
          ) : (
            <p className="text-muted-foreground text-center">Teacher profiles are being updated. Book a free trial and we will match you with the right teacher.</p>
          )}
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
