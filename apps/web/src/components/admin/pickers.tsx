'use client';

import type { Paginated } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { Input, Select } from '@/components/ui/form-controls';
import { api } from '@/lib/api';

export type PersonOption = { id: string; fullName: string; email: string | null; country: string | null };

export function useActiveTeachers() {
  return useQuery({
    queryKey: ['admin', 'teachers-active'],
    queryFn: () => api<Paginated<PersonOption>>('/users?role=teacher&status=ACTIVE&pageSize=100').then((r) => r.items),
    staleTime: 5 * 60_000,
  });
}

export function useCourses() {
  return useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => api<{ id: string; title: string; classMinutes: number; isPublished: boolean }[]>('/courses'),
    staleTime: 5 * 60_000,
  });
}

export function TeacherSelect({ value, onChange, id, allowEmpty, emptyLabel = 'Any teacher' }: { value: string; onChange: (v: string) => void; id?: string; allowEmpty?: boolean; emptyLabel?: string }) {
  const q = useActiveTeachers();
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty ? <option value="">{emptyLabel}</option> : <option value="" disabled>Choose a teacher…</option>}
      {q.data?.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
    </Select>
  );
}

/** Search-as-you-type student picker supporting one or many selections. */
export function StudentPicker({ selected, onChange, multiple = true, id }: { selected: PersonOption[]; onChange: (v: PersonOption[]) => void; multiple?: boolean; id?: string }) {
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'student-search', search],
    queryFn: () => api<Paginated<PersonOption>>(`/users?role=student&status=ACTIVE&pageSize=8&search=${encodeURIComponent(search)}`).then((r) => r.items),
    enabled: search.trim().length >= 2,
  });
  const add = (p: PersonOption) => {
    onChange(multiple ? [...selected.filter((s) => s.id !== p.id), p] : [p]);
    setSearch('');
  };
  return (
    <div className="space-y-2">
      {selected.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <li key={s.id} className="bg-secondary flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-sm">
              {s.fullName}
              <button type="button" aria-label={`Remove ${s.fullName}`} onClick={() => onChange(selected.filter((x) => x.id !== s.id))} className="hover:bg-background rounded p-0.5"><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      ) : null}
      {multiple || !selected.length ? (
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input id={id} className="pl-8" placeholder="Type 2+ letters of a student’s name or email" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
          {search.trim().length >= 2 ? (
            <ul className="bg-popover absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border shadow-md" role="listbox">
              {q.isPending ? <li className="text-muted-foreground px-3 py-2 text-sm">Searching…</li> : q.data?.length ? q.data.map((p) => (
                <li key={p.id}>
                  <button type="button" role="option" aria-selected={selected.some((s) => s.id === p.id)} onClick={() => add(p)} className="hover:bg-secondary w-full px-3 py-2 text-left text-sm">
                    <span className="font-medium">{p.fullName}</span>
                    <span className="text-muted-foreground block text-xs">{p.email ?? 'managed by parent'}{p.country ? ` · ${p.country}` : ''}</span>
                  </button>
                </li>
              )) : <li className="text-muted-foreground px-3 py-2 text-sm">No matching active students</li>}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
