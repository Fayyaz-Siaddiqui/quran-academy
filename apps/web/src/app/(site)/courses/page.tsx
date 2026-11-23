import { Container, CourseCard, CtaBand, PageHero } from '@/components/site/sections';
import { getCourses } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Online Quran Courses',
  description: 'Noorani Qaida, Quran reading, Hifz, Tajweed, Islamic studies and kids classes — one-to-one with qualified teachers.',
  path: '/courses',
});

export default async function CoursesPage() {
  const courses = await getCourses();
  return (
    <>
      <PageHero eyebrow="Courses" title="Online Quran courses for every level" description="Every course is taught live and one-to-one, so lessons move at your pace. Not sure where to start? A free trial includes a level assessment." />
      <section className="py-16">
        <Container className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => <CourseCard key={c.id} course={c} />)}
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
