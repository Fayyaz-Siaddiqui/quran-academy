import type { Metadata } from 'next';
import { getCourses } from '@/lib/content';
import { RegisterTabs } from './register-tabs';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Register as a student, parent or teacher.',
  alternates: { canonical: '/register' },
};

type Props = { searchParams: Promise<{ type?: string; course?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const [{ type, course }, courses] = await Promise.all([searchParams, getCourses()]);
  const initial = type === 'parent' || type === 'teacher' ? type : 'student';
  return <RegisterTabs initial={initial} defaultCourse={course} courses={courses.map((c) => ({ slug: c.slug, title: c.title }))} />;
}
