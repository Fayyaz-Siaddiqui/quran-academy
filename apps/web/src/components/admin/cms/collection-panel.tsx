'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { swapOrder, useCmsMutation } from './cms-shared';

export type CollectionItem = { id: string; sortOrder: number; isPublished: boolean };

/**
 * Generic list editor for ordered, publishable CMS collections
 * (testimonials, FAQs, pricing plans). Each collection supplies its own
 * row renderer and form; the shell handles CRUD, ordering and publishing.
 */
export function CollectionPanel<T extends CollectionItem, F extends Record<string, unknown>>({
  endpoint, noun, icon, renderRow, emptyForm, toForm, toBody, Form, isValid, groupBy,
}: {
  endpoint: string;
  noun: string;
  icon: LucideIcon;
  renderRow: (item: T) => React.ReactNode;
  emptyForm: () => F;
  toForm: (item: T) => F;
  toBody: (form: F) => Record<string, unknown>;
  Form: React.ComponentType<{ value: F; onChange: (v: F) => void }>;
  isValid: (form: F) => boolean;
  /** Optional grouping key; reordering then happens within a group. */
  groupBy?: (item: T) => string;
}) {
  const queryKey = ['cms', endpoint];
  const q = useQuery({ queryKey, queryFn: () => api<T[]>(`/cms/${endpoint}`) });
  const [editing, setEditing] = useState<{ id: string | null; form: F } | null>(null);

  const save = useCmsMutation(
    ({ id, form }: { id: string | null; form: F }) => {
      const body = toBody(form);
      if (id) return api(`/cms/${endpoint}/${id}`, { method: 'PATCH', body });
      const nextOrder = Math.max(-1, ...(q.data ?? []).map((i) => i.sortOrder)) + 1;
      return api(`/cms/${endpoint}`, { method: 'POST', body: { ...body, sortOrder: nextOrder } });
    },
    { queryKey, success: ({ id }) => `${noun} ${id ? 'updated' : 'added'}`, onSuccess: () => setEditing(null) },
  );
  const patch = useCmsMutation(
    (rows: { id: string; body: Record<string, unknown> }[]) => Promise.all(rows.map((r) => api(`/cms/${endpoint}/${r.id}`, { method: 'PATCH', body: r.body }))),
    { queryKey, success: 'Saved' },
  );
  const remove = useCmsMutation((id: string) => api(`/cms/${endpoint}/${id}`, { method: 'DELETE' }), { queryKey, success: `${noun} deleted` });

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;

  const sorted = [...q.data].sort((a, b) => a.sortOrder - b.sortOrder);
  const groups = groupBy
    ? Object.entries(sorted.reduce<Record<string, T[]>>((acc, i) => ((acc[groupBy(i)] ??= []).push(i), acc), {}))
    : [['', sorted] as [string, T[]]];

  const move = (list: T[], index: number, dir: -1 | 1) => {
    const pair = swapOrder(list, index, dir);
    if (pair) patch.mutate(pair.map((p) => ({ id: p.id, body: { sortOrder: p.sortOrder } })));
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{q.data.length} {noun.toLowerCase()}{q.data.length === 1 ? '' : 's'} · {q.data.filter((i) => i.isPublished).length} published</p>
        <Button onClick={() => setEditing({ id: null, form: emptyForm() })}><Plus /> Add {noun.toLowerCase()}</Button>
      </div>

      {q.data.length ? (
        <div className="space-y-6">
          {groups.map(([group, items]) => (
            <div key={group}>
              {group ? <h3 className="mb-2 text-sm font-semibold">{group}</h3> : null}
              <Card className="py-0">
                <CardContent className="divide-y px-0">
                  {items.map((item, i) => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="flex flex-col">
                        <Button variant="ghost" size="icon" className="size-7" aria-label="Move up" disabled={i === 0 || patch.isPending} onClick={() => move(items, i, -1)}><ArrowUp /></Button>
                        <Button variant="ghost" size="icon" className="size-7" aria-label="Move down" disabled={i === items.length - 1 || patch.isPending} onClick={() => move(items, i, 1)}><ArrowDown /></Button>
                      </div>
                      <div className="min-w-0 flex-1">{renderRow(item)}</div>
                      {!item.isPublished ? <Badge variant="warning">hidden</Badge> : null}
                      <div className="flex shrink-0">
                        <Button variant="ghost" size="icon" aria-label={item.isPublished ? 'Hide' : 'Publish'} title={item.isPublished ? 'Hide from website' : 'Publish'}
                          onClick={() => patch.mutate([{ id: item.id, body: { isPublished: !item.isPublished } }])}>
                          {item.isPublished ? <EyeOff /> : <Eye />}
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing({ id: item.id, form: toForm(item) })}><Pencil /></Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive"
                          onClick={() => confirm(`Delete this ${noun.toLowerCase()}? This cannot be undone.`) && remove.mutate(item.id)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={icon} title={`No ${noun.toLowerCase()}s yet`} action={<Button className="mt-2" onClick={() => setEditing({ id: null, form: emptyForm() })}><Plus /> Add the first one</Button>} />
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? `Edit ${noun.toLowerCase()}` : `New ${noun.toLowerCase()}`}</DialogTitle></DialogHeader>
          {editing ? (
            <form id="cms-collection-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}>
              <Form value={editing.form} onChange={(form) => setEditing({ ...editing, form })} />
            </form>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" form="cms-collection-form" disabled={!editing || !isValid(editing.form) || save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
