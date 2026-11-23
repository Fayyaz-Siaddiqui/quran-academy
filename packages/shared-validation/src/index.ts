import { z } from 'zod';
import { AUTH } from '@qa/config';

/**
 * Client-side form schemas. The API validates the same rules independently with
 * class-validator DTOs — these exist for fast, friendly feedback in the browser.
 */

const email = z.string().trim().toLowerCase().email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(AUTH.PASSWORD_MIN_LENGTH, `Use at least ${AUTH.PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number with country code');

const fullName = z.string().trim().min(2, 'Enter your full name').max(120);
const country = z.string().trim().length(2, 'Select your country');
const timezone = z.string().trim().min(3, 'Select your time zone');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const twoFactorSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

const passwordPair = { password: passwordSchema, confirmPassword: z.string() };

function matchPasswords<S extends z.ZodType<{ password: string; confirmPassword: string }>>(schema: S) {
  return schema.refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
}

export const CLASS_TIMINGS = ['early-morning', 'morning', 'afternoon', 'evening', 'night', 'weekend'] as const;
export const LANGUAGES = ['English', 'Arabic', 'Urdu', 'French', 'German', 'Turkish', 'Malay', 'Bengali', 'Somali', 'Indonesian'] as const;

export const guardianSchema = z.object({
  name: fullName,
  email,
  phone,
  relationship: z.string().trim().min(2).max(40),
});

export const registerStudentSchema = matchPasswords(z.object({
  ...passwordPair,
  fullName,
  email,
  phone,
  country,
  timezone,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth'),
  guardian: guardianSchema.optional(),
  preferredCourseSlug: z.string().min(1, 'Choose a course'),
  preferredLanguage: z.string().min(2),
  preferredClassTiming: z.enum(CLASS_TIMINGS),
  acceptTerms: z.literal(true, { message: 'You must accept the terms' }),
}));
export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;

export const childSchema = z.object({
  fullName,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter date of birth'),
  preferredCourseSlug: z.string().min(1, 'Choose a course'),
  preferredLanguage: z.string().min(2),
  preferredClassTiming: z.enum(CLASS_TIMINGS),
  /** Optional login for older children; younger children are managed only via the parent. */
  email: email.optional().or(z.literal('')),
});
export type ChildInput = z.infer<typeof childSchema>;

export const registerParentSchema = matchPasswords(z.object({
  ...passwordPair,
  fullName,
  email,
  phone,
  country,
  timezone,
  children: z.array(childSchema).max(10, 'Up to 10 children can be added at once'),
  acceptTerms: z.literal(true, { message: 'You must accept the terms' }),
}));
export type RegisterParentInput = z.infer<typeof registerParentSchema>;

export const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const registerTeacherSchema = matchPasswords(z.object({
  ...passwordPair,
  fullName,
  email,
  phone,
  country,
  timezone,
  qualifications: z.string().trim().min(10, 'Describe your qualifications').max(2000),
  experienceYears: z.coerce.number().int().min(0).max(60),
  certifications: z.array(z.string().trim().min(2)).max(20),
  languages: z.array(z.string()).min(1, 'Select at least one language'),
  bio: z.string().trim().max(2000).optional(),
  availability: z.array(availabilitySlotSchema).min(1, 'Add at least one available slot'),
  acceptTerms: z.literal(true, { message: 'You must accept the terms' }),
}));
export type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export const freeTrialSchema = z.object({
  fullName,
  email,
  phone,
  country,
  timezone,
  courseSlug: z.string().min(1, 'Choose a course'),
  studentAge: z.coerce.number().int().min(3).max(100).optional(),
  preferredDate: z.string().min(1, 'Choose a preferred date'),
  preferredTime: z.string().min(1, 'Choose a preferred time'),
  numberOfStudents: z.coerce.number().int().min(1).max(10).default(1),
  message: z.string().max(2000).optional(),
});
export type FreeTrialInput = z.infer<typeof freeTrialSchema>;

export const contactSchema = z.object({
  fullName,
  email,
  phone: phone.optional().or(z.literal('')),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10, 'Please write a little more').max(5000),
});
export type ContactInput = z.infer<typeof contactSchema>;

export { z };
