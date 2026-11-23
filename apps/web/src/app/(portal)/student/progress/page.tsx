'use client';

import { PageTitle } from '@/components/portal/portal-shell';
import { ProgressView } from '@/components/portal/progress-view';

export default function StudentProgressPage() {
  return (
    <>
      <PageTitle title="Quran learning progress" description="Every portion you read, memorise and revise — recorded by your teacher." />
      <ProgressView studentId="me" />
    </>
  );
}
