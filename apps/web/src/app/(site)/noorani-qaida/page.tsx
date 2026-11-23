import { CoursePage, courseMetadata } from '@/components/site/course-page';

const SLUG = 'noorani-qaida';

export const generateMetadata = () => courseMetadata(SLUG);

export default function Page() {
  return <CoursePage slug={SLUG} />;
}
