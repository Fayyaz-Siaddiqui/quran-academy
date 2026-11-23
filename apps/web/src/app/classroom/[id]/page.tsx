import type { Metadata } from 'next';
import { Classroom } from './classroom';

export const metadata: Metadata = { title: 'Live class', robots: { index: false, follow: false } };

export default async function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Classroom classId={id} />;
}
