'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { freeTrialSchema } from '@qa/shared-validation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form-controls';
import { api, ApiError } from '@/lib/api';
import { browserTimezone } from '@/lib/utils';
import { CountrySelect, CourseSelect, TimezoneSelect } from './pickers';

export function FreeTrialForm({ courses, defaultCourse }: { courses: { slug: string; title: string }[]; defaultCourse?: string }) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(freeTrialSchema),
    defaultValues: { courseSlug: defaultCourse ?? '', timezone: browserTimezone(), numberOfStudents: 1 },
  });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const honeypot = (document.getElementById('website') as HTMLInputElement | null)?.value;
      await api('/public/trial-bookings', { method: 'POST', body: { ...values, website: honeypot || undefined }, auth: false });
      setDone(true);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  });

  if (done) {
    return (
      <div className="bg-card flex flex-col items-center rounded-xl border p-10 text-center shadow-xs" role="status">
        <CheckCircle2 className="text-success size-12" aria-hidden />
        <h2 className="mt-4 text-2xl font-semibold">Your free trial is requested</h2>
        <p className="text-muted-foreground mt-2 max-w-md">We have emailed you a confirmation. Our team will contact you shortly to confirm the time with your teacher.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="bg-card grid gap-5 rounded-xl border p-6 shadow-xs sm:grid-cols-2 sm:p-8">
      <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} className="sm:col-span-2">
        <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...register('fullName')} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field label="Phone / WhatsApp" htmlFor="phone" error={errors.phone?.message}>
        <Input id="phone" type="tel" autoComplete="tel" placeholder="+44 7700 900000" aria-invalid={!!errors.phone} {...register('phone')} />
      </Field>
      <Field label="Country" htmlFor="country" error={errors.country?.message}>
        <CountrySelect id="country" aria-invalid={!!errors.country} {...register('country')} />
      </Field>
      <Field label="Time zone" htmlFor="timezone" error={errors.timezone?.message}>
        <TimezoneSelect id="timezone" {...register('timezone')} />
      </Field>
      <Field label="Course" htmlFor="courseSlug" error={errors.courseSlug?.message}>
        <CourseSelect id="courseSlug" courses={courses} aria-invalid={!!errors.courseSlug} {...register('courseSlug')} />
      </Field>
      <Field label="Student age (optional)" htmlFor="studentAge" error={errors.studentAge?.message}>
        <Input id="studentAge" type="number" min={3} max={100} {...register('studentAge')} />
      </Field>
      <Field label="Preferred date" htmlFor="preferredDate" error={errors.preferredDate?.message}>
        <Input id="preferredDate" type="date" min={new Date().toISOString().slice(0, 10)} {...register('preferredDate')} />
      </Field>
      <Field label="Preferred time (your time zone)" htmlFor="preferredTime" error={errors.preferredTime?.message}>
        <Input id="preferredTime" type="time" {...register('preferredTime')} />
      </Field>
      <Field label="Number of students" htmlFor="numberOfStudents" error={errors.numberOfStudents?.message}>
        <Input id="numberOfStudents" type="number" min={1} max={10} {...register('numberOfStudents')} />
      </Field>
      <Field label="Anything we should know? (optional)" htmlFor="message" className="sm:col-span-2">
        <Textarea id="message" rows={3} {...register('message')} />
      </Field>
      {/* Honeypot field: hidden from people, filled by bots. */}
      <input id="website" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {serverError ? <p className="text-destructive text-sm sm:col-span-2" role="alert">{serverError}</p> : null}
      <Button type="submit" size="lg" disabled={isSubmitting} className="sm:col-span-2">
        {isSubmitting ? <Loader2 className="animate-spin" /> : null} Book my free class
      </Button>
    </form>
  );
}
