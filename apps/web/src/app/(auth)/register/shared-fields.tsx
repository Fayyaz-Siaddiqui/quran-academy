'use client';

import type { FieldErrors, UseFormRegisterReturn } from 'react-hook-form';
import { CountrySelect, TimezoneSelect } from '@/components/forms/pickers';
import { Checkbox, Field, Input } from '@/components/ui/form-controls';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Accepts any form's typed `register`; these fields use names every registration schema shares.
type Reg = (name: any) => UseFormRegisterReturn<any>;
type Errs = FieldErrors<any>;
const msg = (e: Errs, k: string) => (e[k]?.message as string | undefined) ?? undefined;

/** Name, email, phone, country, time zone, password — common to all three registration forms. */
export function AccountFields({ register, errors, prefix }: { register: Reg; errors: Errs; prefix: string }) {
  const id = (k: string) => `${prefix}-${k}`;
  return (
    <>
      <Field label="Full name" htmlFor={id('name')} error={msg(errors, 'fullName')} className="sm:col-span-2">
        <Input id={id('name')} autoComplete="name" {...register('fullName')} />
      </Field>
      <Field label="Email" htmlFor={id('email')} error={msg(errors, 'email')}>
        <Input id={id('email')} type="email" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Phone (with country code)" htmlFor={id('phone')} error={msg(errors, 'phone')}>
        <Input id={id('phone')} type="tel" autoComplete="tel" placeholder="+1 555 123 4567" {...register('phone')} />
      </Field>
      <Field label="Country" htmlFor={id('country')} error={msg(errors, 'country')}>
        <CountrySelect id={id('country')} {...register('country')} />
      </Field>
      <Field label="Time zone" htmlFor={id('tz')} error={msg(errors, 'timezone')}>
        <TimezoneSelect id={id('tz')} {...register('timezone')} />
      </Field>
    </>
  );
}

export function PasswordFields({ register, errors, prefix }: { register: Reg; errors: Errs; prefix: string }) {
  return (
    <>
      <Field label="Password" htmlFor={`${prefix}-pw`} error={msg(errors, 'password')} hint="10+ characters, upper & lower case and a number">
        <Input id={`${prefix}-pw`} type="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <Field label="Confirm password" htmlFor={`${prefix}-pw2`} error={msg(errors, 'confirmPassword')}>
        <Input id={`${prefix}-pw2`} type="password" autoComplete="new-password" {...register('confirmPassword')} />
      </Field>
    </>
  );
}

export function TermsField({ register, errors, prefix }: { register: Reg; errors: Errs; prefix: string }) {
  return (
    <div className="sm:col-span-2">
      <label htmlFor={`${prefix}-terms`} className="flex items-start gap-2 text-sm">
        <Checkbox id={`${prefix}-terms`} className="mt-0.5" {...register('acceptTerms')} />
        <span>
          I agree to the <a href="/terms-and-conditions" target="_blank" className="text-primary underline">Terms</a> and{' '}
          <a href="/privacy-policy" target="_blank" className="text-primary underline">Privacy Policy</a>.
        </span>
      </label>
      {msg(errors, 'acceptTerms') ? <p className="text-destructive mt-1 text-xs">{msg(errors, 'acceptTerms')}</p> : null}
    </div>
  );
}
