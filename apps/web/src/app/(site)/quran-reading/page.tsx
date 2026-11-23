import { CoursePage, courseMetadata } from '@/components/site/course-page';

const SLUG = 'quran-reading';

export const generateMetadata = () => courseMetadata(SLUG);

export default function Page() {
  return <CoursePage slug={SLUG} />;
}
