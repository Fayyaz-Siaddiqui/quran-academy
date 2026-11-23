'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { ParentForm } from './parent-form';
import { StudentForm } from './student-form';
import { TeacherForm } from './teacher-form';

export type CourseOption = { slug: string; title: string };
export type Registered = { email: string; kind: 'student' | 'parent' | 'teacher' };

export function RegisterTabs({ initial, courses, defaultCourse }: { initial: 'student' | 'parent' | 'teacher'; courses: CourseOption[]; defaultCourse?: string }) {
  const [tab, setTab] = useState(initial);
  const [done, setDone] = useState<Registered | null>(null);

  if (done && done.kind !== 'teacher') {
    return (
      <div role="status">
        <MailCheck className="text-primary size-10" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Verify your email</h1>
        <p className="text-muted-foreground mt-2">
          We sent a verification link to <strong>{done.email}</strong>. Open it to activate your account — the link is valid for 48 hours.
        </p>
        <p className="text-muted-foreground mt-6 text-sm">Already verified? <Link href="/login" className="text-primary hover:underline">Log in</Link></p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Already registered? <Link href="/login" className="text-primary font-medium hover:underline">Log in</Link>
      </p>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList className="w-full">
          <TabsTrigger value="student">Student</TabsTrigger>
          <TabsTrigger value="parent">Parent</TabsTrigger>
          <TabsTrigger value="teacher">Teacher</TabsTrigger>
        </TabsList>
        <TabsContent value="student" className="mt-6"><StudentForm courses={courses} defaultCourse={defaultCourse} onDone={setDone} /></TabsContent>
        <TabsContent value="parent" className="mt-6"><ParentForm courses={courses} defaultCourse={defaultCourse} onDone={setDone} /></TabsContent>
        <TabsContent value="teacher" className="mt-6"><TeacherForm /></TabsContent>
      </Tabs>
    </div>
  );
}
