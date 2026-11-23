'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form-controls';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import { CharCount, useCmsMutation } from './cms-shared';

type Section = { type: 'richText'; heading?: string; body?: string };
type Page = {
  id: string; slug: string; title: string; metaTitle: string | null; metaDescription: string | null; ogImageUrl: string | null;
  sections: Section[]; isPublished: boolean; updatedAt: string;
};

/** Pages the public website renders from the CMS, with their public paths. */
const MANAGED_PAGES: { slug: string; path: string; label: string }[] = [
  { slug: 'about', path: '/about', label: 'About Us' },
  { slug: 'privacy-policy', path: '/privacy-policy', label: 'Privacy Policy' },
  { slug: 'terms-and-conditions', path: '/terms-and-conditions', label: 'Terms and Conditions' },
];

type Draft = Omit<Page, 'id' | 'updatedAt' | 'metaTitle' | 'metaDescription' | 'ogImageUrl'> & { metaTitle: string; metaDescription: string; ogImageUrl: string };

function toDraft(slug: string, page?: Page): Draft {
  return {
    slug,
    title: page?.title ?? MANAGED_PAGES.find((p) => p.slug === slug)?.label ?? '',
    metaTitle: page?.metaTitle ?? '',
    metaDescription: page?.metaDescription ?? '',
    ogImageUrl: page?.ogImageUrl ?? '',
    sections: page?.sections?.length ? page.sections : [{ type: 'richText', heading: '', body: '' }],
    isPublished: page?.isPublished ?? true,
  };
}

function PageEditor({ slug, page }: { slug: string; page?: Page }) {
  const [d, setD] = useState<Draft>(() => toDraft(slug, page));
  useEffect(() => setD(toDraft(slug, page)), [slug, page]);
  const path = MANAGED_PAGES.find((p) => p.slug === slug)?.path ?? `/${slug}`;

  const setSection = (i: number, patch: Partial<Section>) => setD((x) => ({ ...x, sections: x.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, dir: -1 | 1) => setD((x) => {
    const s = [...x.sections];
    [s[i], s[i + dir]] = [s[i + dir]!, s[i]!];
    return { ...x, sections: s };
  });

  const save = useCmsMutation(
    () => api(`/cms/pages/${slug}`, {
      method: 'PUT',
      body: {
        title: d.title,
        metaTitle: d.metaTitle || null,
        metaDescription: d.metaDescription || null,
        ogImageUrl: d.ogImageUrl || undefined,
        isPublished: d.isPublished,
        sections: d.sections.filter((s) => s.heading?.trim() || s.body?.trim()),
      },
    }),
    { queryKey: ['cms', 'pages'], success: `${d.title} saved` },
  );
  const invalid = !d.title.trim() || d.metaTitle.length > 70 || d.metaDescription.length > 170;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {d.title || slug}
          {d.isPublished ? <Badge variant="success">published</Badge> : <Badge variant="warning">hidden</Badge>}
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-3">
          <a href={path} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">{path} <ExternalLink className="size-3" /></a>
          {page ? <span>Last saved {formatDateTime(page.updatedAt)}</span> : <span>Not saved yet — showing default content</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Page title" htmlFor="pg-title"><Input id="pg-title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Content sections</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => setD({ ...d, sections: [...d.sections, { type: 'richText', heading: '', body: '' }] })}><Plus /> Add section</Button>
            </div>
            {d.sections.map((s, i) => (
              <fieldset key={i} className="bg-secondary/40 grid gap-3 rounded-lg border p-4">
                <legend className="sr-only">Section {i + 1}</legend>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold">SECTION {i + 1}</span>
                  <div className="ml-auto flex">
                    <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={i === d.sections.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove section" disabled={d.sections.length === 1} onClick={() => setD({ ...d, sections: d.sections.filter((_, j) => j !== i) })}><Trash2 /></Button>
                  </div>
                </div>
                <Input aria-label="Section heading" placeholder="Heading" value={s.heading ?? ''} onChange={(e) => setSection(i, { heading: e.target.value })} />
                <Textarea aria-label="Section text" rows={5} placeholder="Text. Leave a blank line between paragraphs." value={s.body ?? ''} onChange={(e) => setSection(i, { body: e.target.value })} />
              </fieldset>
            ))}
          </div>

          <fieldset className="grid gap-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Search & sharing</legend>
            <Field label="SEO title" htmlFor="pg-mt" hint="Shown in Google results and browser tabs. Falls back to the page title.">
              <Input id="pg-mt" value={d.metaTitle} onChange={(e) => setD({ ...d, metaTitle: e.target.value })} />
              <p className="text-right text-xs"><CharCount value={d.metaTitle} max={70} /></p>
            </Field>
            <Field label="Meta description" htmlFor="pg-md">
              <Textarea id="pg-md" rows={2} value={d.metaDescription} onChange={(e) => setD({ ...d, metaDescription: e.target.value })} />
              <p className="text-right text-xs"><CharCount value={d.metaDescription} max={170} /></p>
            </Field>
            <Field label="Social share image URL (optional)" htmlFor="pg-og"><Input id="pg-og" type="url" value={d.ogImageUrl} onChange={(e) => setD({ ...d, ogImageUrl: e.target.value })} /></Field>
          </fieldset>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={d.isPublished} onChange={(e) => setD({ ...d, isPublished: e.target.checked })} /> Published</label>
            <Button type="submit" disabled={invalid || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : null} Save page</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PagesPanel() {
  const q = useQuery({ queryKey: ['cms', 'pages'], queryFn: () => api<Page[]>('/cms/pages') });
  const [slug, setSlug] = useState(MANAGED_PAGES[0]!.slug);
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  const bySlug = new Map(q.data.map((p) => [p.slug, p]));

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit py-2">
        {MANAGED_PAGES.length ? (
          <ul>
            {MANAGED_PAGES.map((p) => (
              <li key={p.slug}>
                <button type="button" onClick={() => setSlug(p.slug)} className={cn('hover:bg-secondary flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm', slug === p.slug && 'bg-secondary font-medium')}>
                  <FileText className="text-muted-foreground size-4" /> {bySlug.get(p.slug)?.title ?? p.label}
                  {bySlug.get(p.slug)?.isPublished === false ? <Badge variant="warning" className="ml-auto">hidden</Badge> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={FileText} title="No pages" />}
        <p className="text-muted-foreground border-t px-4 pt-3 pb-2 text-xs">Course pages are edited under Courses; the home page under Site settings.</p>
      </Card>
      <PageEditor slug={slug} page={bySlug.get(slug)} />
    </div>
  );
}
