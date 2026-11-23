'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LANGUAGES, registerTeacherSchema } from '@qa/shared-validation';
import { CheckCircle2, FileUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { api, ApiError, uploadToPresignedUrl } from '@/lib/api';
import { browserTimezone } from '@/lib/utils';
import { AccountFields, PasswordFields, TermsField } from './shared-fields';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type DocType = 'AVATAR' | 'TEACHER_CERTIFICATE' | 'TEACHER_ID' | 'TEACHER_CV';
const DOC_LABELS: Record<DocType, string> = {
  AVATAR: 'Profile photo',
  TEACHER_CERTIFICATE: 'Ijazah / certificates',
  TEACHER_CV: 'CV / résumé',
  TEACHER_ID: 'Government ID',
};

export function TeacherForm() {
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<{ email: string; uploadToken: string } | null>(null);

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerTeacherSchema),
    defaultValues: {
      timezone: browserTimezone(),
      languages: ['English'],
      certifications: [],
      experienceYears: 1,
      availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '13:00' }],
    },
  });
  const slots = useFieldArray({ control, name: 'availability' });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { confirmPassword: _c, ...body } = values;
      const res = await api<{ uploadToken: string }>('/auth/register/teacher', { method: 'POST', body, auth: false });
      setRegistered({ email: values.email, uploadToken: res.uploadToken });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Registration failed');
    }
  });

  if (registered) return <TeacherDocuments {...registered} />;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <AccountFields register={register} errors={errors} prefix="t" />
      <Field label="Qualifications" htmlFor="t-qual" error={errors.qualifications?.message} className="sm:col-span-2" hint="Ijazah, degrees, institutes attended">
        <Textarea id="t-qual" rows={3} {...register('qualifications')} />
      </Field>
      <Field label="Years of teaching experience" htmlFor="t-exp" error={errors.experienceYears?.message}>
        <Input id="t-exp" type="number" min={0} max={60} {...register('experienceYears')} />
      </Field>
      <Field label="Quran / Tajweed certifications" htmlFor="t-certs" hint="Separate with commas">
        <Controller
          control={control}
          name="certifications"
          render={({ field }) => (
            <Input id="t-certs" defaultValue={field.value?.join(', ')} onBlur={(e) => field.onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
          )}
        />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium">Languages you teach in</legend>
        <Controller
          control={control}
          name="languages"
          render={({ field }) => (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {LANGUAGES.map((l) => (
                <label key={l} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value?.includes(l)}
                    onChange={(e) => field.onChange(e.target.checked ? [...(field.value ?? []), l] : field.value?.filter((x: string) => x !== l))}
                  />
                  {l}
                </label>
              ))}
            </div>
          )}
        />
        {errors.languages?.message ? <p className="text-destructive mt-1 text-xs">{errors.languages.message}</p> : null}
      </fieldset>
      <Field label="Short bio (optional)" htmlFor="t-bio" className="sm:col-span-2">
        <Textarea id="t-bio" rows={3} {...register('bio')} />
      </Field>

      <div className="sm:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Available hours (your time zone)</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => slots.append({ dayOfWeek: 1, startTime: '17:00', endTime: '21:00' })}><Plus /> Add slot</Button>
        </div>
        <div className="mt-3 space-y-2">
          {slots.fields.map((s, i) => (
            <div key={s.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
              <Select aria-label="Day" {...register(`availability.${i}.dayOfWeek`, { valueAsNumber: true })}>
                {DAYS.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
              </Select>
              <Input aria-label="From" type="time" className="w-28" {...register(`availability.${i}.startTime`)} />
              <Input aria-label="To" type="time" className="w-28" {...register(`availability.${i}.endTime`)} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove slot" onClick={() => slots.remove(i)} disabled={slots.fields.length === 1}><Trash2 /></Button>
            </div>
          ))}
        </div>
        {errors.availability?.message ? <p className="text-destructive mt-1 text-xs">{errors.availability.message}</p> : null}
      </div>

      <PasswordFields register={register} errors={errors} prefix="t" />
      <TermsField register={register} errors={errors} prefix="t" />
      {error ? <p className="text-destructive text-sm sm:col-span-2" role="alert">{error}</p> : null}
      <Button type="submit" size="lg" disabled={isSubmitting} className="sm:col-span-2">
        {isSubmitting ? <Loader2 className="animate-spin" /> : null} Submit application
      </Button>
      <p className="text-muted-foreground text-xs sm:col-span-2">Teacher accounts are activated after our academic team approves your application.</p>
    </form>
  );
}

/** Step 2: attach photo and supporting documents using the short-lived onboarding token. */
function TeacherDocuments({ email, uploadToken }: { email: string; uploadToken: string }) {
  const [uploaded, setUploaded] = useState<Partial<Record<DocType, string>>>({});
  const [busy, setBusy] = useState<DocType | null>(null);

  const upload = async (type: DocType, file: File) => {
    setBusy(type);
    try {
      const { url, key } = await api<{ url: string; key: string }>('/auth/register/teacher/documents/upload-url', {
        method: 'POST',
        auth: false,
        body: { uploadToken, type, fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      });
      await uploadToPresignedUrl(url, file);
      await api('/auth/register/teacher/documents/confirm', { method: 'POST', auth: false, body: { uploadToken, key } });
      setUploaded((u) => ({ ...u, [type]: file.name }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <CheckCircle2 className="text-success size-10" aria-hidden />
      <h2 className="mt-4 text-xl font-bold">Application received</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Please verify your email via the link sent to <strong>{email}</strong>. Meanwhile, attach your photo and supporting documents (PDF, JPG, PNG — max 10 MB) to speed up review.
      </p>
      <ul className="mt-6 space-y-3">
        {(Object.keys(DOC_LABELS) as DocType[]).map((t) => (
          <li key={t} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{DOC_LABELS[t]}</p>
              {uploaded[t] ? <p className="text-success truncate text-xs">✓ {uploaded[t]}</p> : null}
            </div>
            <label className="shrink-0">
              <input
                type="file"
                className="sr-only"
                accept={t === 'AVATAR' ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp'}
                onChange={(e) => e.target.files?.[0] && upload(t, e.target.files[0])}
                disabled={busy !== null}
              />
              <span className="hover:bg-secondary inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm">
                {busy === t ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} {uploaded[t] ? 'Replace' : 'Upload'}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-6 text-xs">You can close this page at any time. Uploads are stored privately and only seen by our review team.</p>
    </div>
  );
}
