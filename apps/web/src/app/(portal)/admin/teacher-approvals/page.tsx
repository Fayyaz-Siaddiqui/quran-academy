'use client';

import { PERMISSIONS, type Paginated } from '@qa/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, Loader2, UserCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/form-controls';
import { Badge, EmptyState, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { can, useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type Application = {
  userId: string; qualifications: string; experienceYears: number; certifications: string[]; languages: string[]; bio: string | null;
  approvalStatus: string; reviewNotes: string | null;
  availability: { id: string; dayOfWeek: number; startTime: string; endTime: string; timezone: string }[];
  user: { id: string; fullName: string; email: string; phone: string | null; country: string | null; timezone: string; status: string; emailVerifiedAt: string | null; createdAt: string;
    documents: { id: string; type: string; fileName: string }[] };
};

export default function TeacherApprovalsPage() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [review, setReview] = useState<{ app: Application; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [notes, setNotes] = useState('');

  const q = useQuery({ queryKey: ['admin', 'applications', status], queryFn: () => api<Paginated<Application>>(`/teachers/applications?status=${status}&pageSize=50`) });
  const decide = useMutation({
    mutationFn: () => api(`/teachers/${review!.app.userId}/review`, { method: 'PATCH', body: { decision: review!.decision, notes: notes || undefined } }),
    onSuccess: () => {
      toast.success(review!.decision === 'APPROVED' ? 'Teacher approved and notified' : 'Application rejected and applicant notified');
      setReview(null); setNotes('');
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save decision'),
  });
  const openDoc = async (id: string) => {
    try {
      const { url } = await api<{ url: string }>(`/documents/${id}/url`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not open document');
    }
  };

  return (
    <>
      <PageTitle title="Teacher approvals" description="Review applicants’ qualifications, availability and documents before they can teach." />
      <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <TabsList><TabsTrigger value="PENDING">Pending</TabsTrigger><TabsTrigger value="APPROVED">Approved</TabsTrigger><TabsTrigger value="REJECTED">Rejected</TabsTrigger></TabsList>
      </Tabs>
      <div className="mt-4 grid gap-4">
        {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} retry={() => q.refetch()} /> : q.data.items.length ? q.data.items.map((a) => (
          <Card key={a.userId}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {a.user.fullName}
                {a.user.emailVerifiedAt ? <Badge variant="success">email verified</Badge> : <Badge variant="warning">email not verified</Badge>}
              </CardTitle>
              <CardDescription>{a.user.email} · {a.user.phone} · {a.user.country} · applied {formatDate(a.user.createdAt)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-2 text-sm lg:col-span-2">
                <p><span className="font-medium">Experience:</span> {a.experienceYears} years</p>
                <p className="whitespace-pre-line"><span className="font-medium">Qualifications:</span> {a.qualifications}</p>
                {a.certifications.length ? <div className="flex flex-wrap gap-1.5">{a.certifications.map((c) => <Badge key={c} variant="gold">{c}</Badge>)}</div> : null}
                <p><span className="font-medium">Languages:</span> {a.languages.join(', ')}</p>
                {a.bio ? <p className="text-muted-foreground">{a.bio}</p> : null}
                <p className="font-medium">Availability ({a.user.timezone}):</p>
                <ul className="flex flex-wrap gap-1.5">{a.availability.map((s) => <li key={s.id}><Badge variant="outline">{DAYS[s.dayOfWeek]} {s.startTime}–{s.endTime}</Badge></li>)}</ul>
                {a.reviewNotes ? <p className="bg-muted rounded p-2 text-xs">Review notes: {a.reviewNotes}</p> : null}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">Documents</p>
                {a.user.documents.length ? (
                  <ul className="space-y-1.5">
                    {a.user.documents.map((d) => (
                      <li key={d.id}><button type="button" onClick={() => openDoc(d.id)} className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"><FileText className="size-4" /> {d.type.replace('TEACHER_', '').toLowerCase()}: {d.fileName}</button></li>
                    ))}
                  </ul>
                ) : <p className="text-muted-foreground text-sm">No documents uploaded.</p>}
                {can(me, PERMISSIONS.TEACHERS_APPROVE) && status !== 'APPROVED' ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" onClick={() => setReview({ app: a, decision: 'APPROVED' })}><CheckCircle2 /> Approve</Button>
                    {status === 'PENDING' ? <Button size="sm" variant="outline" className="text-destructive" onClick={() => setReview({ app: a, decision: 'REJECTED' })}><XCircle /> Reject</Button> : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )) : <EmptyState icon={UserCheck} title={`No ${status.toLowerCase()} applications`} />}
      </div>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{review?.decision === 'APPROVED' ? 'Approve' : 'Reject'} {review?.app.user.fullName}?</DialogTitle>
            <DialogDescription>
              {review?.decision === 'APPROVED'
                ? review.app.user.emailVerifiedAt ? 'Their account becomes active immediately and they are emailed a sign-in link.' : 'They will be able to sign in as soon as they verify their email.'
                : 'The applicant is emailed your reason.'}
            </DialogDescription>
          </DialogHeader>
          <Field label={review?.decision === 'REJECTED' ? 'Reason (required)' : 'Internal notes (optional)'} htmlFor="rv-notes">
            <Textarea id="rv-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>Cancel</Button>
            <Button variant={review?.decision === 'REJECTED' ? 'destructive' : 'default'} onClick={() => decide.mutate()} disabled={decide.isPending || (review?.decision === 'REJECTED' && !notes.trim())}>
              {decide.isPending ? <Loader2 className="animate-spin" /> : null} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
