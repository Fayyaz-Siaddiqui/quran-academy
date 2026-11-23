import { permanentRedirect } from 'next/navigation';
import { CoursePage, courseMetadata } from '@/components/site/course-page';
import { DEDICATED_COURSE_PATHS } from '@/components/site/sections';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return courseMetadata((await params).slug);
}

export default async function CourseDetail({ params }: Props) {
  const { slug } = await params;
  // Avoid duplicate content: core courses live at their dedicated root URL.
  if (DEDICATED_COURSE_PATHS.has(slug)) permanentRedirect(`/${slug}`);
  return <CoursePage slug={slug} />;
}
