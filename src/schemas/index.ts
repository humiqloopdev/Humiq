// src/schemas/index.ts
import { z } from 'zod';

/* ── Auth ───────────────────────────────────────────────────── */
export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/* ── Candidate Onboarding ───────────────────────────────────── */
export const onboardingAccountSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  phone: z.string().trim().min(7, 'Enter a valid phone number'),
});
export type OnboardingAccountInput = z.infer<typeof onboardingAccountSchema>;

export const skillsSchema = z.object({
  primaryRole: z.string().trim().min(2, 'Primary role is required'),
  experience: z.string().min(1, 'Select your experience level'),
  skills: z.array(z.string()).min(1, 'Add at least one skill'),
  certifications: z.string().optional(),
});
export type SkillsInput = z.infer<typeof skillsSchema>;

export const preferencesSchema = z
  .object({
    commitment: z.string().min(1, 'Select a commitment type'),
    minRate: z.coerce.number().min(1, 'Enter a minimum rate'),
    preferredRate: z.coerce.number().min(1, 'Enter a preferred rate'),
    timezone: z.string().trim().min(1, 'Timezone is required'),
    availability: z.string().min(1, 'Select your availability'),
  })
  .refine((data) => data.preferredRate >= data.minRate, {
    message: 'Preferred rate must be greater than or equal to minimum rate',
    path: ['preferredRate'],
  });
export type PreferencesInput = z.infer<typeof preferencesSchema>;

/* ── Employer Onboarding ────────────────────────────────────── */
export const companyProfileSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required'),
  website: z
    .string()
    .trim()
    .min(1, 'Website is required')
    .url('Enter a valid URL, e.g. https://acmecorp.com'),
  industry: z.string().trim().min(2, 'Industry is required'),
  headquarters: z.string().trim().min(2, 'Headquarters is required'),
  size: z.string().min(1, 'Select a company size'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const billingSchema = z.object({
  plan: z.string().min(1, 'Select a plan'),
  billingEmail: z.string().trim().min(1, 'Billing email is required').email('Enter a valid email address'),
  inviteEmail: z.union([z.string().trim().email('Enter a valid email address'), z.literal('')]).optional(),
});
export type BillingInput = z.infer<typeof billingSchema>;
