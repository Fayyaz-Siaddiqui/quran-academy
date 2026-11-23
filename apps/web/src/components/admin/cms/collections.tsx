'use client';

import { CreditCard, HelpCircle, Quote, Star } from 'lucide-react';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Badge } from '@/components/ui/misc';
import { formatMoney } from '@/lib/utils';
import { blankToNull } from './cms-shared';
import { CollectionPanel, type CollectionItem } from './collection-panel';

// ───────────── Testimonials ─────────────

type Testimonial = CollectionItem & { name: string; location: string | null; role: string | null; quote: string; rating: number; avatarUrl: string | null };
type TestimonialForm = { name: string; location: string; role: string; quote: string; rating: number; avatarUrl: string };

function TestimonialFields({ value: v, onChange }: { value: TestimonialForm; onChange: (v: TestimonialForm) => void }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="t-name"><Input id="t-name" value={v.name} onChange={(e) => onChange({ ...v, name: e.target.value })} /></Field>
        <Field label="Location" htmlFor="t-loc"><Input id="t-loc" placeholder="London, UK" value={v.location} onChange={(e) => onChange({ ...v, location: e.target.value })} /></Field>
        <Field label="Who they are" htmlFor="t-role"><Input id="t-role" placeholder="Parent of two" value={v.role} onChange={(e) => onChange({ ...v, role: e.target.value })} /></Field>
        <Field label="Rating" htmlFor="t-rating">
          <Select id="t-rating" value={v.rating} onChange={(e) => onChange({ ...v, rating: Number(e.target.value) })}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Quote" htmlFor="t-quote" hint="10–2000 characters"><Textarea id="t-quote" rows={5} value={v.quote} onChange={(e) => onChange({ ...v, quote: e.target.value })} /></Field>
      <Field label="Photo URL (optional)" htmlFor="t-avatar"><Input id="t-avatar" type="url" value={v.avatarUrl} onChange={(e) => onChange({ ...v, avatarUrl: e.target.value })} /></Field>
    </>
  );
}

export function TestimonialsPanel() {
  return (
    <CollectionPanel<Testimonial, TestimonialForm>
      endpoint="testimonials"
      noun="Testimonial"
      icon={Quote}
      emptyForm={() => ({ name: '', location: '', role: '', quote: '', rating: 5, avatarUrl: '' })}
      toForm={(t) => ({ name: t.name, location: t.location ?? '', role: t.role ?? '', quote: t.quote, rating: t.rating, avatarUrl: t.avatarUrl ?? '' })}
      toBody={(f) => blankToNull(f)}
      isValid={(f) => f.name.trim().length >= 2 && f.quote.trim().length >= 10}
      Form={TestimonialFields}
      renderRow={(t) => (
        <>
          <p className="font-medium">{t.name} <span className="text-gold ml-1 inline-flex" aria-label={`${t.rating} stars`}>{Array.from({ length: t.rating }, (_, i) => <Star key={i} className="fill-gold size-3" />)}</span></p>
          <p className="text-muted-foreground text-xs">{[t.role, t.location].filter(Boolean).join(' · ')}</p>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">“{t.quote}”</p>
        </>
      )}
    />
  );
}

// ───────────── FAQs ─────────────

type Faq = CollectionItem & { category: string; question: string; answer: string };
type FaqForm = { category: string; question: string; answer: string };
const FAQ_CATEGORIES = ['General', 'Teachers', 'Scheduling', 'Pricing', 'Parents', 'Technical'];

function FaqFields({ value: v, onChange }: { value: FaqForm; onChange: (v: FaqForm) => void }) {
  return (
    <>
      <Field label="Category" htmlFor="f-cat" hint="FAQs are grouped by category on the FAQ page">
        <Input id="f-cat" list="faq-categories" value={v.category} onChange={(e) => onChange({ ...v, category: e.target.value })} />
        <datalist id="faq-categories">{FAQ_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Question" htmlFor="f-q"><Input id="f-q" value={v.question} onChange={(e) => onChange({ ...v, question: e.target.value })} /></Field>
      <Field label="Answer" htmlFor="f-a"><Textarea id="f-a" rows={6} value={v.answer} onChange={(e) => onChange({ ...v, answer: e.target.value })} /></Field>
    </>
  );
}

export function FaqsPanel() {
  return (
    <CollectionPanel<Faq, FaqForm>
      endpoint="faqs"
      noun="FAQ"
      icon={HelpCircle}
      groupBy={(f) => f.category}
      emptyForm={() => ({ category: 'General', question: '', answer: '' })}
      toForm={(f) => ({ category: f.category, question: f.question, answer: f.answer })}
      toBody={(f) => ({ ...f, category: f.category.trim() || 'General' })}
      isValid={(f) => f.question.trim().length >= 5 && f.answer.trim().length >= 5}
      Form={FaqFields}
      renderRow={(f) => (
        <>
          <p className="font-medium">{f.question}</p>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{f.answer}</p>
        </>
      )}
    />
  );
}

// ───────────── Pricing ─────────────

type Plan = CollectionItem & {
  name: string; description: string | null; currency: string; priceMonthly: number; classesPerWeek: number; classMinutes: number; features: string[]; isHighlighted: boolean;
};
type PlanForm = { name: string; description: string; currency: string; price: string; classesPerWeek: number; classMinutes: number; features: string; isHighlighted: boolean };
const CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SAR'];

function PlanFields({ value: v, onChange }: { value: PlanForm; onChange: (v: PlanForm) => void }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan name" htmlFor="p-name"><Input id="p-name" value={v.name} onChange={(e) => onChange({ ...v, name: e.target.value })} /></Field>
        <Field label="Short description" htmlFor="p-desc"><Input id="p-desc" value={v.description} onChange={(e) => onChange({ ...v, description: e.target.value })} /></Field>
        <Field label="Monthly price" htmlFor="p-price">
          <div className="flex gap-2">
            <Select aria-label="Currency" className="w-24" value={v.currency} onChange={(e) => onChange({ ...v, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Input id="p-price" inputMode="decimal" placeholder="65.00" value={v.price} onChange={(e) => onChange({ ...v, price: e.target.value })} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Classes / week" htmlFor="p-cpw"><Input id="p-cpw" type="number" min={1} max={7} value={v.classesPerWeek} onChange={(e) => onChange({ ...v, classesPerWeek: Number(e.target.value) })} /></Field>
          <Field label="Minutes" htmlFor="p-min"><Input id="p-min" type="number" min={15} max={180} step={5} value={v.classMinutes} onChange={(e) => onChange({ ...v, classMinutes: Number(e.target.value) })} /></Field>
        </div>
      </div>
      <Field label="Features" htmlFor="p-feat" hint="One per line"><Textarea id="p-feat" rows={5} value={v.features} onChange={(e) => onChange({ ...v, features: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.isHighlighted} onChange={(e) => onChange({ ...v, isHighlighted: e.target.checked })} /> Highlight as “Most popular”</label>
    </>
  );
}

const parsePrice = (s: string) => {
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && s.trim() !== '' ? Math.round(n * 100) : NaN;
};

export function PricingPanel() {
  return (
    <CollectionPanel<Plan, PlanForm>
      endpoint="pricing"
      noun="Plan"
      icon={CreditCard}
      emptyForm={() => ({ name: '', description: '', currency: 'USD', price: '', classesPerWeek: 3, classMinutes: 30, features: '', isHighlighted: false })}
      toForm={(p) => ({
        name: p.name, description: p.description ?? '', currency: p.currency, price: (p.priceMonthly / 100).toFixed(2),
        classesPerWeek: p.classesPerWeek, classMinutes: p.classMinutes, features: p.features.join('\n'), isHighlighted: p.isHighlighted,
      })}
      toBody={(f) => ({
        name: f.name.trim(),
        description: f.description.trim() || null,
        currency: f.currency,
        priceMonthly: parsePrice(f.price),
        classesPerWeek: f.classesPerWeek,
        classMinutes: f.classMinutes,
        features: f.features.split('\n').map((x) => x.trim()).filter(Boolean),
        isHighlighted: f.isHighlighted,
      })}
      isValid={(f) => f.name.trim().length >= 2 && !Number.isNaN(parsePrice(f.price)) && f.classesPerWeek >= 1 && f.classesPerWeek <= 7 && f.classMinutes >= 15 && f.classMinutes <= 180}
      Form={PlanFields}
      renderRow={(p) => (
        <>
          <p className="font-medium">{p.name} {p.isHighlighted ? <Badge variant="gold" className="ml-1">most popular</Badge> : null}</p>
          <p className="text-muted-foreground text-sm">{formatMoney(p.priceMonthly, p.currency)} / month · {p.classesPerWeek}× {p.classMinutes} min per week · {p.features.length} features</p>
        </>
      )}
    />
  );
}
