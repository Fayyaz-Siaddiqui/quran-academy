import { Container, CtaBand, FaqSection, PageHero, PricingTable, SectionHeading } from '@/components/site/sections';
import { getFaqs, getPricing } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Pricing — Online Quran Classes',
  description: 'Simple monthly plans for one-to-one online Quran classes. Family discounts available. Your first class is free.',
  path: '/pricing',
});

export default async function PricingPage() {
  const [plans, faqs] = await Promise.all([getPricing(), getFaqs()]);
  return (
    <>
      <PageHero eyebrow="Pricing" title="Simple, transparent monthly plans" description="Every plan includes live one-to-one classes, recordings, homework and progress tracking. Family discounts are available for siblings." />
      <section className="py-16"><Container><PricingTable plans={plans} /></Container></section>
      <section className="bg-secondary/40 border-y py-16">
        <Container className="max-w-3xl">
          <SectionHeading title="Pricing questions" />
          <div className="mt-8"><FaqSection faqs={faqs} /></div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
