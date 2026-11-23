'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CLASS_TIMINGS, LANGUAGES, registerStudentSchema } from '@qa/shared-validation';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { CLASS_TIMING_LABELS, CourseSelect } from '@/components/forms/pickers';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { api, ApiError } from '@/lib/api';
import { browserTimezone } from '@/lib/utils';
import type { CourseOption, Registered } from './register-tabs';
import { AccountFields, PasswordFields, TermsField } from './shared-fields';

function ageFrom(dob?: string) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86_400_000));
}

export function StudentForm({ courses, defaultCourse, onDone }: { courses: CourseOption[]; defaultCourse?: string; onDone: (r: Registered) => void }) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerStudentSchema),
    // Guardian inputs unmount for adults, so their (empty) values must not be submitted.
    shouldUnregister: true,
    defaultValues: { timezone: browserTimezone(), preferredCourseSlug: defaultCourse ?? '', preferredLanguage: 'English', preferredClassTiming: 'evening' },
  });
  const dob = useWatch({ control, name: 'dateOfBirth' });
  const age = ageFrom(dob);
  const minor = age !== null && age < 18;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    if (minor && !values.guardian) return setError('Please add parent/guardian details.');
    try {
      const { confirmPassword: _c, ...body } = values;
      await api('/auth/register/student', { method: 'POST', body, auth: false });
      onDone({ email: values.email, kind: 'student' });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Registration failed');
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <AccountFields register={register} errors={errors} prefix="s" />
      <Field label="Date of birth" htmlFor="s-dob" error={errors.dateOfBirth?.message}>
        <Input id="s-dob" type="date" max={new Date().toISOString().slice(0, 10)} {...register('dateOfBirth')} />
      </Field>
      <Field label="Preferred course" htmlFor="s-course" error={errors.preferredCourseSlug?.message}>
        <CourseSelect id="s-course" courses={courses} {...register('preferredCourseSlug')} />
      </Field>
      <Field label="Preferred language" htmlFor="s-lang" error={errors.preferredLanguage?.message}>
        <Select id="s-lang" {...register('preferredLanguage')}>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </Select>
      </Field>
      <Field label="Preferred class timing" htmlFor="s-timing" error={errors.preferredClassTiming?.message}>
        <Select id="s-timing" {...register('preferredClassTiming')}>
          {CLASS_TIMINGS.map((t) => <option key={t} value={t}>{CLASS_TIMING_LABELS[t]}</option>)}
        </Select>
      </Field>

      {minor ? (
        <fieldset className="bg-secondary/50 grid gap-4 rounded-lg p-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Parent / guardian (required under 18)</legend>
          <Field label="Guardian name" htmlFor="g-name" error={errors.guardian?.name?.message}>
            <Input id="g-name" {...register('guardian.name')} />
          </Field>
          <Field label="Relationship" htmlFor="g-rel" error={errors.guardian?.relationship?.message}>
            <Input id="g-rel" placeholder="Mother, father…" {...register('guardian.relationship')} />
          </Field>
          <Field label="Guardian email" htmlFor="g-email" error={errors.guardian?.email?.message}>
            <Input id="g-email" type="email" {...register('guardian.email')} />
          </Field>
          <Field label="Guardian phone" htmlFor="g-phone" error={errors.guardian?.phone?.message}>
            <Input id="g-phone" type="tel" {...register('guardian.phone')} />
          </Field>
        </fieldset>
      ) : null}

      <PasswordFields register={register} errors={errors} prefix="s" />
      <TermsField register={register} errors={errors} prefix="s" />
      {error ? <p className="text-destructive text-sm sm:col-span-2" role="alert">{error}</p> : null}
      <Button type="submit" size="lg" disabled={isSubmitting} className="sm:col-span-2">
        {isSubmitting ? <Loader2 className="animate-spin" /> : null} Create student account
      </Button>
    </form>
  );
}
