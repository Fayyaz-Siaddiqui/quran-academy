'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/misc';
import type { Faq } from '@/lib/content';

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion type="single" collapsible className="bg-card rounded-xl border px-5">
      {faqs.map((f) => (
        <AccordionItem key={f.id} value={f.id}>
          <AccordionTrigger className="text-base">{f.question}</AccordionTrigger>
          <AccordionContent>{f.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
