'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CLASS_TIMINGS, LANGUAGES, registerParentSchema } from '@qa/shared-validation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { CLASS_TIMING_LABELS, CourseSelect } from '@/components/forms/pickers';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { api, ApiError } from '@/lib/api';
import { browserTimezone } from '@/lib/utils';
import type { CourseOption, Registered } from './register-tabs';
import { AccountFields, PasswordFields, TermsField } from './shared-fields';

export function ParentForm({ courses, defaultCourse, onDone }: { courses: CourseOption[]; defaultCourse?: string; onDone: (r: Registered) => void }) {
  const [error, setError] = useState<string | null>(null);
  const blankChild = { fullName: '', dateOfBirth: '', preferredCourseSlug: defaultCourse ?? '', preferredLanguage: 'English', preferredClassTiming: 'evening' as const, email: '' };
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerParentSchema),
    defaultValues: { timezone: browserTimezone(), children: [blankChild] },
  });
  const children = useFieldArray({ control, name: 'children' });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { confirmPassword: _c, ...body } = values;
      await api('/auth/register/parent', {
        method: 'POST',
        body: { ...body, children: body.children.map((c) => ({ ...c, email: c.email || undefined })) },
        auth: false,
      });
      onDone({ email: values.email, kind: 'parent' });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Registration failed');
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <AccountFields register={register} errors={errors} prefix="p" />
      <PasswordFields register={register} errors={errors} prefix="p" />

      <div className="sm:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your children</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => children.append(blankChild)} disabled={children.fields.length >= 10}>
            <Plus /> Add child
          </Button>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">You can also add children later from your parent portal.</p>
      </div>

      {children.fields.map((f, i) => {
        const ce = errors.children?.[i];
        return (
          <fieldset key={f.id} className="bg-secondary/50 grid gap-4 rounded-lg p-4 sm:col-span-2 sm:grid-cols-2">
            <legend className="flex w-full items-center justify-between px-1 text-sm font-semibold">
              Child {i + 1}
            </legend>
            <Field label="Child’s full name" htmlFor={`c${i}-name`} error={ce?.fullName?.message}>
              <Input id={`c${i}-name`} {...register(`children.${i}.fullName`)} />
            </Field>
            <Field label="Date of birth" htmlFor={`c${i}-dob`} error={ce?.dateOfBirth?.message}>
              <Input id={`c${i}-dob`} type="date" {...register(`children.${i}.dateOfBirth`)} />
            </Field>
            <Field label="Course" htmlFor={`c${i}-course`} error={ce?.preferredCourseSlug?.message}>
              <CourseSelect id={`c${i}-course`} courses={courses} {...register(`children.${i}.preferredCourseSlug`)} />
            </Field>
            <Field label="Class timing" htmlFor={`c${i}-timing`}>
              <Select id={`c${i}-timing`} {...register(`children.${i}.preferredClassTiming`)}>
                {CLASS_TIMINGS.map((t) => <option key={t} value={t}>{CLASS_TIMING_LABELS[t]}</option>)}
              </Select>
            </Field>
            <Field label="Language" htmlFor={`c${i}-lang`}>
              <Select id={`c${i}-lang`} {...register(`children.${i}.preferredLanguage`)}>
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Child’s own email (optional)" htmlFor={`c${i}-email`} error={ce?.email?.message} hint="Only for older children who will log in themselves">
              <Input id={`c${i}-email`} type="email" {...register(`children.${i}.email`)} />
            </Field>
            {children.fields.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" className="text-destructive justify-self-start" onClick={() => children.remove(i)}>
                <Trash2 /> Remove
              </Button>
            ) : null}
          </fieldset>
        );
      })}

      <TermsField register={register} errors={errors} prefix="p" />
      {error ? <p className="text-destructive text-sm sm:col-span-2" role="alert">{error}</p> : null}
      <Button type="submit" size="lg" disabled={isSubmitting} className="sm:col-span-2">
        {isSubmitting ? <Loader2 className="animate-spin" /> : null} Create parent account
      </Button>
    </form>
  );
}
