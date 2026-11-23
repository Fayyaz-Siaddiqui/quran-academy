'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBlock, LoadingBlock } from '@/components/portal/query-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/form-controls';
import { api } from '@/lib/api';
import { CharCount, useCmsMutation } from './cms-shared';

type Settings = Record<string, Record<string, unknown> | undefined>;
type FieldDef = { name: string; label: string; textarea?: boolean; max?: number; hint?: string; type?: string };

const SECTIONS: { key: string; title: string; description: string; fields: FieldDef[] }[] = [
  {
    key: 'site', title: 'Academy identity', description: 'Name and tagline shown in the header, footer and browser titles.',
    fields: [
      { name: 'name', label: 'Academy name', max: 80 },
      { name: 'tagline', label: 'Tagline', max: 160 },
      { name: 'logoUrl', label: 'Logo URL (optional)', type: 'url', hint: 'Leave empty to use the built-in mark' },
    ],
  },
  {
    key: 'contact', title: 'Contact details', description: 'Shown in the footer and on the Contact page. The email also receives new contact-form messages.',
    fields: [
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone' },
      { name: 'address', label: 'Address / location' },
      { name: 'hours', label: 'Opening hours' },
    ],
  },
  {
    key: 'whatsapp', title: 'WhatsApp', description: 'The floating chat button. Leave the number empty to hide it.',
    fields: [
      { name: 'number', label: 'Number with country code', hint: 'Digits only, e.g. 447700900123' },
      { name: 'message', label: 'Pre-filled greeting', textarea: true, max: 300 },
    ],
  },
  {
    key: 'seo', title: 'Search engine defaults', description: 'Used for the home page and any page without its own SEO fields.',
    fields: [
      { name: 'defaultTitle', label: 'Default title', max: 70 },
      { name: 'defaultDescription', label: 'Default meta description', textarea: true, max: 170 },
    ],
  },
  {
    key: 'social', title: 'Social media', description: 'Full profile URLs. Empty links are hidden from the footer.',
    fields: [
      { name: 'facebook', label: 'Facebook', type: 'url' },
      { name: 'instagram', label: 'Instagram', type: 'url' },
      { name: 'youtube', label: 'YouTube', type: 'url' },
      { name: 'x', label: 'X (Twitter)', type: 'url' },
    ],
  },
];

function SettingCard({ section, initial }: { section: (typeof SECTIONS)[number]; initial: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    setValues(Object.fromEntries(section.fields.map((f) => [f.name, (initial[f.name] as string | null) ?? ''])));
  }, [initial, section.fields]);
  const dirty = section.fields.some((f) => (values[f.name] ?? '') !== ((initial[f.name] as string | null) ?? ''));
  const tooLong = section.fields.some((f) => f.max && (values[f.name]?.length ?? 0) > f.max);

  const save = useCmsMutation(
    () => api(`/cms/settings/${section.key}`, {
      method: 'PUT',
      // Preserve keys this form doesn't manage; empty logo becomes null.
      body: { value: { ...initial, ...values, ...(section.key === 'site' ? { logoUrl: values.logoUrl || null } : {}) } },
    }),
    { queryKey: ['cms', 'settings'], success: `${section.title} saved` },
  );

  return (
    <Card>
      <CardHeader><CardTitle>{section.title}</CardTitle><CardDescription>{section.description}</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          {section.fields.map((f) => {
            const id = `set-${section.key}-${f.name}`;
            const props = { id, value: values[f.name] ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [f.name]: e.target.value })) };
            return (
              <Field key={f.name} label={f.label} htmlFor={id} hint={f.hint}>
                {f.textarea ? <Textarea rows={3} {...props} /> : <Input type={f.type ?? 'text'} {...props} />}
                {f.max ? <p className="text-right text-xs"><CharCount value={values[f.name]} max={f.max} /></p> : null}
              </Field>
            );
          })}
          <Button type="submit" disabled={!dirty || tooLong || save.isPending} className="justify-self-start">
            {save.isPending ? <Loader2 className="animate-spin" /> : null} Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type Home = { heroTitle: string; heroSubtitle: string; stats: { label: string; value: string }[] };

function HomeCard({ initial }: { initial: Partial<Home> }) {
  const [home, setHome] = useState<Home>({ heroTitle: '', heroSubtitle: '', stats: [] });
  useEffect(() => setHome({ heroTitle: initial.heroTitle ?? '', heroSubtitle: initial.heroSubtitle ?? '', stats: initial.stats ?? [] }), [initial]);
  const setStat = (i: number, k: 'label' | 'value', v: string) => setHome((h) => ({ ...h, stats: h.stats.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const save = useCmsMutation(
    () => api('/cms/settings/home', { method: 'PUT', body: { value: { ...initial, ...home, stats: home.stats.filter((s) => s.label && s.value) } } }),
    { queryKey: ['cms', 'settings'], success: 'Homepage saved' },
  );
  return (
    <Card className="xl:col-span-2">
      <CardHeader><CardTitle>Homepage hero</CardTitle><CardDescription>The headline, introduction and trust statistics at the top of the home page.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Headline" htmlFor="home-title"><Input id="home-title" value={home.heroTitle} onChange={(e) => setHome({ ...home, heroTitle: e.target.value })} /></Field>
          <Field label="Introduction" htmlFor="home-sub"><Textarea id="home-sub" rows={3} value={home.heroSubtitle} onChange={(e) => setHome({ ...home, heroSubtitle: e.target.value })} /></Field>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Statistics (up to 4 look best)</p>
              <Button type="button" size="sm" variant="outline" disabled={home.stats.length >= 6} onClick={() => setHome({ ...home, stats: [...home.stats, { label: '', value: '' }] })}><Plus /> Add</Button>
            </div>
            <div className="grid gap-2">
              {home.stats.map((s, i) => (
                <div key={i} className="grid grid-cols-[120px_1fr_auto] gap-2">
                  <Input aria-label="Value" placeholder="2,500+" value={s.value} onChange={(e) => setStat(i, 'value', e.target.value)} />
                  <Input aria-label="Label" placeholder="Students taught" value={s.label} onChange={(e) => setStat(i, 'label', e.target.value)} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove statistic" onClick={() => setHome({ ...home, stats: home.stats.filter((_, j) => j !== i) })}><Trash2 /></Button>
                </div>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={save.isPending || !home.heroTitle.trim()} className="justify-self-start">{save.isPending ? <Loader2 className="animate-spin" /> : null} Save homepage</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SettingsPanel() {
  const q = useQuery({ queryKey: ['cms', 'settings'], queryFn: () => api<Settings>('/cms/settings') });
  if (q.isPending) return <LoadingBlock rows={4} />;
  if (q.isError) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <HomeCard initial={(q.data.home ?? {}) as Partial<Home>} />
      {SECTIONS.map((s) => <SettingCard key={s.key} section={s} initial={q.data[s.key] ?? {}} />)}
    </div>
  );
}
