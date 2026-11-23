'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Loader2, Newspaper, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Badge, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { CharCount, useCmsMutation } from './cms-shared';

type Post = {
  id: string; slug: string; title: string; excerpt: string; content: string; coverImageUrl: string | null; tags: string[];
  metaTitle: string | null; metaDescription: string | null; publishedAt: string | null; updatedAt: string;
};
type Draft = {
  slug: string; title: string; excerpt: string; content: string; coverImageUrl: string; tags: string;
  metaTitle: string; metaDescription: string; mode: 'draft' | 'now' | 'schedule'; scheduleAt: string;
};

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
/** ISO → value for <input type="datetime-local"> in the browser's zone. */
const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };

function status(p: Post): { label: string; variant: 'success' | 'secondary' | 'warning' } {
  if (!p.publishedAt) return { label: 'draft', variant: 'secondary' };
  return new Date(p.publishedAt) > new Date() ? { label: 'scheduled', variant: 'warning' } : { label: 'published', variant: 'success' };
}

function toDraft(p?: Post): Draft {
  const scheduled = p?.publishedAt && new Date(p.publishedAt) > new Date();
  return {
    slug: p?.slug ?? '', title: p?.title ?? '', excerpt: p?.excerpt ?? '', content: p?.content ?? '', coverImageUrl: p?.coverImageUrl ?? '',
    tags: p?.tags.join(', ') ?? '', metaTitle: p?.metaTitle ?? '', metaDescription: p?.metaDescription ?? '',
    mode: !p?.publishedAt ? 'draft' : scheduled ? 'schedule' : 'now',
    scheduleAt: p?.publishedAt ? toLocalInput(p.publishedAt) : '',
  };
}

function PostEditor({ post, onDone }: { post?: Post; onDone: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(post));
  const [slugTouched, setSlugTouched] = useState(!!post);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const publishedAt =
    d.mode === 'draft' ? null
      : d.mode === 'schedule' ? (d.scheduleAt ? new Date(d.scheduleAt).toISOString() : null)
        // Keep the original date when re-saving an already-published post.
        : post?.publishedAt && new Date(post.publishedAt) <= new Date() ? post.publishedAt : new Date().toISOString();

  const save = useCmsMutation(
    () => {
      const body = {
        slug: d.slug, title: d.title.trim(), excerpt: d.excerpt.trim(), content: d.content,
        coverImageUrl: d.coverImageUrl || null,
        tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
        metaTitle: d.metaTitle || null, metaDescription: d.metaDescription || null,
        publishedAt,
      };
      return post ? api(`/cms/blog/${post.id}`, { method: 'PATCH', body }) : api('/cms/blog', { method: 'POST', body });
    },
    { queryKey: ['cms', 'blog'], success: post ? 'Article saved' : 'Article created', onSuccess: onDone },
  );
  const remove = useCmsMutation(() => api(`/cms/blog/${post!.id}`, { method: 'DELETE' }), { queryKey: ['cms', 'blog'], success: 'Article deleted', onSuccess: onDone });

  const problems = [
    d.title.trim().length < 2 && 'a title',
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug) && 'a valid URL slug',
    d.excerpt.trim().length < 10 && 'an excerpt (10+ characters)',
    d.content.trim().length < 10 && 'content',
    d.mode === 'schedule' && !d.scheduleAt && 'a publish date',
    (d.metaTitle.length > 70 || d.metaDescription.length > 170 || d.excerpt.length > 500) && 'shorter SEO fields',
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}><ArrowLeft /> All articles</Button>
        {post && status(post).label === 'published' ? (
          <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="text-primary ml-auto inline-flex items-center gap-1 text-sm hover:underline">View on site <ExternalLink className="size-3" /></a>
        ) : null}
      </div>
      <form className="grid gap-6 xl:grid-cols-[1fr_320px]" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <Card>
          <CardContent className="grid gap-4">
            <Field label="Title" htmlFor="b-title">
              <Input id="b-title" className="text-lg font-semibold" value={d.title} onChange={(e) => set({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })} />
            </Field>
            <Field label="URL slug" htmlFor="b-slug" hint={post && status(post).label === 'published' ? 'Changing the slug of a published article breaks existing links.' : `/blog/${d.slug || '…'}`}>
              <Input id="b-slug" value={d.slug} onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }); }} />
            </Field>
            <Field label="Excerpt" htmlFor="b-excerpt" hint="Shown on the blog index and as the default meta description">
              <Textarea id="b-excerpt" rows={2} value={d.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
            </Field>
            <Tabs defaultValue="write">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Content <span className="text-muted-foreground font-normal">(Markdown: ## heading, **bold**, - list, [link](url))</span></span>
                <TabsList><TabsTrigger value="write">Write</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList>
              </div>
              <TabsContent value="write" className="mt-2">
                <Textarea aria-label="Article content" rows={22} className="font-mono text-sm" value={d.content} onChange={(e) => set({ content: e.target.value })} />
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div className="prose-content min-h-80 rounded-md border p-4">{d.content ? <ReactMarkdown>{d.content}</ReactMarkdown> : <p>Nothing to preview yet.</p>}</div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Publishing</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Select aria-label="Publishing status" value={d.mode} onChange={(e) => set({ mode: e.target.value as Draft['mode'] })}>
                <option value="draft">Draft (not visible)</option>
                <option value="now">Published</option>
                <option value="schedule">Scheduled</option>
              </Select>
              {d.mode === 'schedule' ? <Input type="datetime-local" aria-label="Publish at" value={d.scheduleAt} onChange={(e) => set({ scheduleAt: e.target.value })} /> : null}
              {problems.length ? <p className="text-muted-foreground text-xs">Still needed: {problems.join(', ')}.</p> : null}
              <Button type="submit" disabled={problems.length > 0 || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : null} {post ? 'Save changes' : 'Create article'}</Button>
              {post ? (
                <Button type="button" variant="ghost" className="text-destructive" disabled={remove.isPending}
                  onClick={() => confirm('Delete this article permanently?') && remove.mutate(undefined)}>
                  <Trash2 /> Delete
                </Button>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Field label="Cover image URL" htmlFor="b-cover"><Input id="b-cover" type="url" value={d.coverImageUrl} onChange={(e) => set({ coverImageUrl: e.target.value })} /></Field>
              {d.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.coverImageUrl} alt="" className="aspect-video w-full rounded-md object-cover" />
              ) : null}
              <Field label="Tags" htmlFor="b-tags" hint="Comma separated"><Input id="b-tags" value={d.tags} onChange={(e) => set({ tags: e.target.value })} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Field label="SEO title" htmlFor="b-mt">
                <Input id="b-mt" placeholder={d.title} value={d.metaTitle} onChange={(e) => set({ metaTitle: e.target.value })} />
                <p className="text-right text-xs"><CharCount value={d.metaTitle} max={70} /></p>
              </Field>
              <Field label="Meta description" htmlFor="b-md">
                <Textarea id="b-md" rows={3} placeholder={d.excerpt} value={d.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} />
                <p className="text-right text-xs"><CharCount value={d.metaDescription} max={170} /></p>
              </Field>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

export function BlogPanel() {
  const q = useQuery({ queryKey: ['cms', 'blog'], queryFn: () => api<Post[]>('/cms/blog') });
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);

  if (editing) {
    const post = editing.id ? q.data?.find((p) => p.id === editing.id) : undefined;
    return <PostEditor key={editing.id ?? 'new'} post={post} onDone={() => setEditing(null)} />;
  }
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{q.data.length} article{q.data.length === 1 ? '' : 's'}</p>
        <Button onClick={() => setEditing({ id: null })}><Plus /> New article</Button>
      </div>
      {q.data.length ? (
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {q.data.map((p) => {
              const s = status(p);
              return (
                <button key={p.id} type="button" onClick={() => setEditing({ id: p.id })} className="hover:bg-secondary/50 flex w-full items-center gap-3 px-4 py-3 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="text-muted-foreground truncate text-xs">/blog/{p.slug} · {p.publishedAt ? `${s.label === 'scheduled' ? 'goes live' : 'published'} ${formatDateTime(p.publishedAt)}` : `edited ${formatDateTime(p.updatedAt)}`}</p>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : <EmptyState icon={Newspaper} title="No articles yet" action={<Button className="mt-2" onClick={() => setEditing({ id: null })}><Plus /> Write the first article</Button>} />}
    </>
  );
}
