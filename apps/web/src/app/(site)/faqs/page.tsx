import { Container, CtaBand, FaqSection, PageHero } from '@/components/site/sections';
import { getFaqs } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Frequently Asked Questions',
  description: 'Answers about online Quran classes, teachers, scheduling across time zones, pricing and the parent portal.',
  path: '/faqs',
});

export default async function FaqsPage() {
  const faqs = await getFaqs();
  const groups = Object.entries(
    faqs.reduce<Record<string, typeof faqs>>((acc, f) => ((acc[f.category] ??= []).push(f), acc), {}),
  );
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <PageHero eyebrow="FAQs" title="Frequently asked questions" description="Can’t find what you need? Message us on WhatsApp or use the contact form." />
      <section className="py-16">
        <Container className="max-w-3xl space-y-10">
          {groups.map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-4 text-xl font-semibold">{category}</h2>
              <FaqSection faqs={items} />
            </div>
          ))}
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
