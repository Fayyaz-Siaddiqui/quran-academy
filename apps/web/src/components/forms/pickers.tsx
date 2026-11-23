'use client';

import * as React from 'react';
import { Select } from '@/components/ui/form-controls';
import { COUNTRIES } from '@/lib/countries';
import { TIMEZONES } from '@/lib/utils';

export const CountrySelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(function CountrySelect(props, ref) {
  return (
    <Select ref={ref} {...props}>
      <option value="">Select country…</option>
      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
    </Select>
  );
});

export const TimezoneSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(function TimezoneSelect(props, ref) {
  return (
    <Select ref={ref} {...props}>
      <option value="">Select time zone…</option>
      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
    </Select>
  );
});

export const CourseSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'> & { courses: { slug: string; title: string }[] }>(
  function CourseSelect({ courses, ...props }, ref) {
    return (
      <Select ref={ref} {...props}>
        <option value="">Choose a course…</option>
        {courses.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
      </Select>
    );
  },
);

export const CLASS_TIMING_LABELS: Record<string, string> = {
  'early-morning': 'Early morning (5–8 am)',
  morning: 'Morning (8 am–12 pm)',
  afternoon: 'Afternoon (12–4 pm)',
  evening: 'Evening (4–8 pm)',
  night: 'Night (8–11 pm)',
  weekend: 'Weekends only',
};
