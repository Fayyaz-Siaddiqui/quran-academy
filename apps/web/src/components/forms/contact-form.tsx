'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { contactSchema } from '@qa/shared-validation';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form-controls';
import { api, ApiError } from '@/lib/api';

export function ContactForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(contactSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const honeypot = (document.getElementById('contact-website') as HTMLInputElement | null)?.value;
      await api('/public/contact', { method: 'POST', body: { ...values, website: honeypot || undefined }, auth: false });
      toast.success('Thank you — we will reply soon, in shā’ Allāh.');
      reset();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send your message');
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="bg-card grid gap-5 rounded-xl border p-6 shadow-xs sm:grid-cols-2">
      <Field label="Full name" htmlFor="c-name" error={errors.fullName?.message}>
        <Input id="c-name" autoComplete="name" {...register('fullName')} />
      </Field>
      <Field label="Email" htmlFor="c-email" error={errors.email?.message}>
        <Input id="c-email" type="email" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Phone (optional)" htmlFor="c-phone" error={errors.phone?.message}>
        <Input id="c-phone" type="tel" {...register('phone')} />
      </Field>
      <Field label="Subject" htmlFor="c-subject" error={errors.subject?.message}>
        <Input id="c-subject" {...register('subject')} />
      </Field>
      <Field label="Message" htmlFor="c-message" error={errors.message?.message} className="sm:col-span-2">
        <Textarea id="c-message" rows={5} {...register('message')} />
      </Field>
      <input id="contact-website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Button type="submit" disabled={isSubmitting} className="sm:col-span-2 sm:justify-self-start">
        {isSubmitting ? <Loader2 className="animate-spin" /> : null} Send message
      </Button>
    </form>
  );
}
