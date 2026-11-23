'use client';

import { PERMISSIONS, type EnrollmentRow, type Paginated } from '@qa/shared-types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { StudentPicker, TeacherSelect, useCourses, type PersonOption } from '@/components/admin/pickers';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { Badge, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { can, useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/utils';

type Awaiting = {
  id: string; fullName: string; email: string | null; country: string | null; timezone: string; createdAt: string;
  studentProfile: { preferredClassTiming: string | null; preferredCourse: { id: string; title: string } | null } | null;
  childLinks: { parent: { fullName: string; email: string | null; phone: string | null } }[];
};
const STATUS_VARIANT = { ACTIVE: 'success', PENDING: 'warning', PAUSED: 'secondary', COMPLETED: 'gold', CANCELLED: 'outline' } as const;
const err = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f);

function useInvalidate() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: ['admin'] }); void qc.invalidateQueries({ queryKey: ['enrollments'] }); };
}

function EnrollDialog({ initialStudent, initialCourseId, onClose }: { initialStudent?: PersonOption; initialCourseId?: string; onClose: () => void }) {
  const invalidate = useInvalidate();
  const courses = useCourses();
  const [student, setStudent] = useState<PersonOption[]>(initialStudent ? [initialStudent] : []);
  const [courseId, setCourseId] = useState(initialCourseId ?? '');
  const [teacherId, setTeacherId] = useState('');
  const m = useMutation({
    mutationFn: () => api('/enrollments', { method: 'POST', body: { studentId: student[0]!.id, courseId, teacherId: teacherId || undefined } }),
    onSuccess: () => { toast.success(`${student[0]!.fullName} enrolled — student${teacherId ? ' and teacher' : ''} notified`); invalidate(); onClose(); },
    onError: (e) => toast.error(err(e, 'Could not enrol student')),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Enrol a student</DialogTitle><DialogDescription>Assigning a teacher also makes them the student’s primary teacher if none is set.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <Field label="Student" htmlFor="en-student"><StudentPicker id="en-student" multiple={false} selected={student} onChange={setStudent} /></Field>
          <Field label="Course" htmlFor="en-course">
            <Select id="en-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="" disabled>Choose a course…</option>
              {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}{c.isPublished ? '' : ' (unpublished)'}</option>)}
            </Select>
          </Field>
          <Field label="Teacher" htmlFor="en-teacher" hint="Optional — can be assigned later"><TeacherSelect id="en-teacher" value={teacherId} onChange={setTeacherId} allowEmpty emptyLabel="Assign later" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !student.length || !courseId}>{m.isPending ? <Loader2 className="animate-spin" /> : null} Enrol</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditEnrollmentDialog({ row, onClose }: { row: EnrollmentRow; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [status, setStatus] = useState(row.status);
  const [teacherId, setTeacherId] = useState(row.teacher?.id ?? '');
  const m = useMutation({
    mutationFn: () => api(`/enrollments/${row.id}`, { method: 'PATCH', body: { status, teacherId: teacherId || null } }),
    onSuccess: () => { toast.success('Enrolment updated'); invalidate(); onClose(); },
    onError: (e) => toast.error(err(e, 'Could not update enrolment')),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{row.student.fullName} — {row.course.title}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <Field label="Status" htmlFor="ee-status">
            <Select id="ee-status" value={status} onChange={(e) => setStatus(e.target.value as EnrollmentRow['status'])}>
              {Object.keys(STATUS_VARIANT).map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </Select>
          </Field>
          <Field label="Teacher" htmlFor="ee-teacher"><TeacherSelect id="ee-teacher" value={teacherId} onChange={setTeacherId} allowEmpty emptyLabel="No teacher" /></Field>
          <p className="text-muted-foreground text-xs">Changing the teacher does not move already-scheduled classes — reschedule those from the Schedule.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? <Loader2 className="animate-spin" /> : null} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EnrollmentsPage() {
  const user = useAuthStore((s) => s.user);
  const manage = can(user, PERMISSIONS.ENROLLMENTS_MANAGE);
  const [enrolling, setEnrolling] = useState<{ student?: PersonOption; courseId?: string } | null>(null);
  const [editing, setEditing] = useState<EnrollmentRow | null>(null);
  const [status, setStatus] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const awaiting = useQuery({ queryKey: ['admin', 'awaiting'], queryFn: () => api<Awaiting[]>('/enrollments/awaiting') });
  const params = new URLSearchParams({ page: String(page), pageSize: '25', ...(status ? { status } : {}), ...(search ? { search } : {}) });
  const list = useQuery({ queryKey: ['enrollments', params.toString()], queryFn: () => api<Paginated<EnrollmentRow>>(`/enrollments?${params}`), placeholderData: keepPreviousData });
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <>
      <PageTitle title="Enrolments" description="Place students on courses with a teacher. Students and teachers are notified automatically."
        actions={manage ? <Button onClick={() => setEnrolling({})}><UserPlus /> Enrol a student</Button> : null} />
      <Tabs defaultValue="awaiting">
        <TabsList>
          <TabsTrigger value="awaiting">Waiting {awaiting.data?.length ? `(${awaiting.data.length})` : ''}</TabsTrigger>
          <TabsTrigger value="all">All enrolments</TabsTrigger>
        </TabsList>

        <TabsContent value="awaiting" className="mt-4">
          <Card>
            <CardContent>
              {awaiting.isPending ? <LoadingBlock /> : awaiting.isError ? <ErrorBlock error={awaiting.error} /> : awaiting.data.length ? (
                <ul className="divide-y">
                  {awaiting.data.map((s) => {
                    const parent = s.childLinks[0]?.parent;
                    return (
                      <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{s.fullName}</p>
                          <p className="text-muted-foreground text-xs">
                            Wants {s.studentProfile?.preferredCourse?.title ?? 'no course chosen'}
                            {s.studentProfile?.preferredClassTiming ? ` · ${s.studentProfile.preferredClassTiming.replace('-', ' ')}` : ''}
                            {' · '}{s.timezone.replace(/_/g, ' ')} · registered {formatDate(s.createdAt)}
                          </p>
                          <p className="text-muted-foreground text-xs">{parent ? `Parent: ${parent.fullName} · ${parent.email ?? parent.phone ?? ''}` : s.email}</p>
                        </div>
                        {manage ? (
                          <Button size="sm" onClick={() => setEnrolling({ student: { id: s.id, fullName: s.fullName, email: s.email, country: s.country }, courseId: s.studentProfile?.preferredCourse?.id })}>Enrol</Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : <EmptyState icon={UserPlus} title="Everyone is enrolled" description="New students appear here after verifying their email." />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                  <Input className="pl-8" placeholder="Search student name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search enrolments" />
                </div>
                <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status filter">
                  <option value="">All statuses</option>
                  {Object.keys(STATUS_VARIANT).map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </Select>
              </div>
              {list.isPending ? <LoadingBlock /> : list.isError ? <ErrorBlock error={list.error} /> : list.data.items.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground border-b text-left text-xs"><tr><th className="py-2 pr-3 font-medium">Student</th><th className="py-2 pr-3 font-medium">Course</th><th className="py-2 pr-3 font-medium">Teacher</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Since</th><th /></tr></thead>
                    <tbody className="divide-y">
                      {list.data.items.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 pr-3"><p className="font-medium">{r.student.fullName}</p><p className="text-muted-foreground text-xs">{r.student.country} · {r.student.timezone.replace(/_/g, ' ')}</p></td>
                          <td className="py-2.5 pr-3">{r.course.title}</td>
                          <td className="py-2.5 pr-3">{r.teacher?.fullName ?? <Badge variant="warning">unassigned</Badge>}</td>
                          <td className="py-2.5 pr-3"><Badge variant={STATUS_VARIANT[r.status]}>{r.status.toLowerCase()}</Badge></td>
                          <td className="text-muted-foreground py-2.5 pr-3 text-xs whitespace-nowrap">{formatDate(r.startedAt ?? r.createdAt)}</td>
                          <td className="py-2.5 text-right">{manage ? <Button size="icon" variant="ghost" aria-label="Edit enrolment" onClick={() => setEditing(r)}><Pencil /></Button> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={UserPlus} title="No enrolments match" />}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{list.data?.total ?? 0} enrolments</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span className="tabular-nums">{page} / {pages}</span>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {enrolling ? <EnrollDialog initialStudent={enrolling.student} initialCourseId={enrolling.courseId} onClose={() => setEnrolling(null)} /> : null}
      {editing ? <EditEnrollmentDialog row={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
