import { Clock, Mail, MessageCircle, Phone } from 'lucide-react';
import { ContactForm } from '@/components/forms/contact-form';
import { Container, PageHero } from '@/components/site/sections';
import { getSite } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Contact Us',
  description: 'Get in touch by WhatsApp, email or phone. We reply to students and parents in every time zone.',
  path: '/contact',
});

export default async function ContactPage() {
  const site = await getSite();
  const wa = `https://wa.me/${site.whatsapp.number.replace(/\D/g, '')}?text=${encodeURIComponent(site.whatsapp.message)}`;
  return (
    <>
      <PageHero eyebrow="Contact" title="We’re here to help" description="Questions about classes, teachers or scheduling? Reach us any way you prefer." />
      <section className="py-14">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <ul className="space-y-4">
            <li className="bg-card flex gap-4 rounded-xl border p-5">
              <MessageCircle className="mt-0.5 size-6 shrink-0 text-[#25D366]" aria-hidden />
              <div><h2 className="font-semibold">WhatsApp</h2><a href={wa} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline">Chat with us now</a></div>
            </li>
            <li className="bg-card flex gap-4 rounded-xl border p-5">
              <Mail className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
              <div><h2 className="font-semibold">Email</h2><a href={`mailto:${site.contact.email}`} className="text-muted-foreground text-sm hover:underline">{site.contact.email}</a></div>
            </li>
            <li className="bg-card flex gap-4 rounded-xl border p-5">
              <Phone className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
              <div><h2 className="font-semibold">Phone</h2><a href={`tel:${site.contact.phone.replace(/\s/g, '')}`} className="text-muted-foreground text-sm hover:underline">{site.contact.phone}</a></div>
            </li>
            <li className="bg-card flex gap-4 rounded-xl border p-5">
              <Clock className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
              <div><h2 className="font-semibold">Hours</h2><p className="text-muted-foreground text-sm">{site.contact.hours}</p></div>
            </li>
          </ul>
          <ContactForm />
        </Container>
      </section>
    </>
  );
}
