'use client';

import { Table2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type BarDatum = { key: string; label: string; /** Full label for tooltip / table. */ detail: string; value: number };

/**
 * Single-series vertical bar chart, plain HTML/CSS so marks stay exact at any width.
 * - No legend: the card title names the single series.
 * - Marks: bars ≤ 28px wide with a 4px rounded data-end anchored to the baseline; columns are
 *   separated by at least 2px of surface.
 * - Hover/focus: tooltip; the hit target is the whole column, not just the bar.
 * - Fill: validated --chart-1 token. Text uses text tokens only.
 * - "View as table" gives a non-visual equivalent.
 */
export function BarChart({ data, unit, ariaLabel }: { data: BarDatum[]; unit: string; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 50) * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  if (asTable) {
    return (
      <div>
        <table className="w-full text-sm">
          <caption className="sr-only">{ariaLabel}</caption>
          <thead className="text-muted-foreground text-left text-xs"><tr><th className="py-1.5 font-medium">Period</th><th className="py-1.5 text-right font-medium capitalize">{unit}</th></tr></thead>
          <tbody className="divide-y">{data.map((d) => <tr key={d.key}><td className="py-1.5">{d.detail}</td><td className="py-1.5 text-right tabular-nums">{d.value}</td></tr>)}</tbody>
        </table>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAsTable(false)}>Show chart</Button>
      </div>
    );
  }

  return (
    <figure aria-label={ariaLabel}>
      <div className="flex gap-2">
        {/* Y axis labels (recessive) */}
        <div className="text-muted-foreground relative h-40 w-6 shrink-0 text-right text-[11px] tabular-nums" aria-hidden>
          {ticks.map((t) => <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(t / top) * 100}%` }}>{t}</span>)}
        </div>
        <div className="relative h-40 flex-1">
          {ticks.map((t) => (
            <div key={t} aria-hidden className={cn('absolute inset-x-0 border-t', t === 0 ? 'border-border' : 'border-border/60 border-dashed')} style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex">
            {data.map((d, i) => (
              <div
                key={d.key}
                tabIndex={0}
                aria-label={`${d.detail}: ${d.value} ${unit}`}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                className="focus-visible:ring-ring/50 relative flex flex-1 items-end justify-center rounded-sm px-px outline-none focus-visible:ring-2"
              >
                {d.value > 0 ? (
                  <div
                    className="w-full max-w-7 rounded-t-[4px] transition-opacity"
                    style={{ height: `${(d.value / top) * 100}%`, background: 'var(--chart-1)', opacity: active === null || active === i ? 1 : 0.45 }}
                  />
                ) : null}
                {/* Selective direct label: peak only, hidden while hovering */}
                {i === peak && d.value > 0 && active === null ? (
                  <span className="text-foreground absolute text-[11px] font-semibold tabular-nums" style={{ bottom: `calc(${(d.value / top) * 100}% + 2px)` }} aria-hidden>{d.value}</span>
                ) : null}
                {active === i ? (
                  <div role="status" className={cn('bg-popover text-popover-foreground pointer-events-none absolute bottom-full z-10 mb-1 rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md',
                    i < data.length / 3 ? 'left-0' : i > (data.length * 2) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2')}>
                    <p className="text-muted-foreground">{d.detail}</p>
                    <p className="font-semibold tabular-nums">{d.value} {unit}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex pl-8" aria-hidden>
        {data.map((d) => <span key={d.key} className="text-muted-foreground flex-1 truncate text-center text-[11px]">{d.label}</span>)}
      </div>
      <Button variant="ghost" size="sm" className="text-muted-foreground mt-1 h-7 px-2 text-xs" onClick={() => setAsTable(true)}><Table2 className="size-3.5" /> View as table</Button>
    </figure>
  );
}
