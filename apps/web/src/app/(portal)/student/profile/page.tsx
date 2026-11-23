'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageTitle } from '@/components/portal/portal-shell';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, UserAvatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Profile = {
  fullName: string; email: string | null; phone: string | null; country: string | null; timezone: string; preferredLanguage: string | null; createdAt: string;
  studentProfile: { dateOfBirth: string | null; preferredClassTiming: string | null; level: string | null; guardianName: string | null; guardianEmail: string | null; guardianPhone: string | null; guardianRelationship: string | null; preferredCourse: { title: string } | null } | null;
  parents: { id: string; fullName: string; email: string | null; phone: string | null }[];
  assignedTeacher: { id: string; fullName: string; country: string | null; teacherProfile: { bio: string | null; languages: string[]; experienceYears: number; certifications: string[] } | null } | null;
};

function Row({ label, value }: { label: string; value?: string | null }) {
  return <div className="grid grid-cols-[140px_1fr] gap-2 py-2 text-sm"><dt className="text-muted-foreground">{label}</dt><dd>{value || '—'}</dd></div>;
}

export default function StudentProfilePage() {
  const q = useQuery({ queryKey: ['student-profile'], queryFn: () => api<Profile>('/students/me/profile') });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  const p = q.data;
  const sp = p.studentProfile;
  return (
    <>
      <PageTitle title="My profile" actions={<Button variant="outline" asChild><Link href="/account">Edit details</Link></Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label="Name" value={p.fullName} />
              <Row label="Email" value={p.email} />
              <Row label="Phone" value={p.phone} />
              <Row label="Country" value={p.country} />
              <Row label="Time zone" value={p.timezone} />
              <Row label="Language" value={p.preferredLanguage} />
              <Row label="Date of birth" value={sp?.dateOfBirth ? formatDate(sp.dateOfBirth, 'UTC') : null} />
              <Row label="Class timing" value={sp?.preferredClassTiming} />
              <Row label="Level" value={sp?.level} />
              <Row label="Member since" value={formatDate(p.createdAt)} />
            </dl>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Assigned teacher</CardTitle></CardHeader>
            <CardContent>
              {p.assignedTeacher ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={p.assignedTeacher.fullName} className="size-12" />
                    <div>
                      <p className="font-medium">{p.assignedTeacher.fullName}</p>
                      <p className="text-muted-foreground text-xs">{p.assignedTeacher.teacherProfile?.experienceYears}+ years · {p.assignedTeacher.teacherProfile?.languages.join(', ')}</p>
                    </div>
                  </div>
                  {p.assignedTeacher.teacherProfile?.bio ? <p className="text-muted-foreground text-sm">{p.assignedTeacher.teacherProfile.bio}</p> : null}
                  <div className="flex flex-wrap gap-1.5">{p.assignedTeacher.teacherProfile?.certifications.map((c) => <Badge key={c} variant="gold">{c}</Badge>)}</div>
                </div>
              ) : <p className="text-muted-foreground text-sm">A teacher will be assigned after your assessment class.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Parent / guardian</CardTitle></CardHeader>
            <CardContent>
              {p.parents.length ? (
                <ul className="space-y-2 text-sm">{p.parents.map((x) => <li key={x.id}><span className="font-medium">{x.fullName}</span> <span className="text-muted-foreground">· {x.email ?? x.phone}</span></li>)}</ul>
              ) : sp?.guardianName ? (
                <dl className="divide-y"><Row label="Name" value={sp.guardianName} /><Row label="Relationship" value={sp.guardianRelationship} /><Row label="Email" value={sp.guardianEmail} /><Row label="Phone" value={sp.guardianPhone} /></dl>
              ) : <p className="text-muted-foreground text-sm">No guardian on file.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
