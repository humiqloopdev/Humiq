// src/types/index.ts

/* ── User / Auth ────────────────────────────────────────────── */
export type UserRole = 'candidate' | 'employer' | 'admin';

export interface User {
  id: string | number;
  name: string;
  email: string;
  role: UserRole;
  [key: string]: unknown;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

/* ── Common UI primitives ──────────────────────────────────── */
export type ButtonVariant = 'primary' | 'outline' | 'navy' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | '';

export type BadgeVariant = 'gray' | 'green' | 'blue' | 'amber' | 'purple' | 'red';

export type AccentColor = 'navy' | 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'gray';

export interface MetricCardProps {
  icon?: React.ReactNode;
  value: React.ReactNode;
  label: string;
  delta?: string;
  up?: boolean;
  accent?: AccentColor;
}

/* ── Domain models ──────────────────────────────────────────── */
export interface Job {
  id: number | string;
  title: string;
  company: string;
  meta: string;
  skills: string[];
  score: number;
  ago: string;
  apps: number;
}

export interface PoolCandidate {
  id: number | string;
  init: string;
  name: string;
  role: string;
  skills: string[];
  score: number;
  sc: 'green' | 'blue' | 'amber' | 'gray';
  status: string;
  sb: string;
}

export interface EmployerJobRow {
  role: string;
  range: string;
  apps: number;
  sl: number;
  status: 'Active' | 'Paused';
}

export interface ActivityItem {
  dot: string;
  msg: string;
  sub: string;
}

export interface PipelineStep {
  done: boolean;
  active?: boolean;
  label: string;
  sub: string;
}

export interface ScoreItem {
  label: string;
  value: number;
}

export interface ChecklistItem {
  done: boolean;
  label: string;
  sub: string;
}

/* ── Generic table row helper (used by columns.tsx files alongside TanStack ColumnDef) */
export interface KeyValueRow {
  label: string;
  value: string;
}

/* ── Form values ────────────────────────────────────────────── */
export interface SignUpFormValues {
  name: string;
  email: string;
  password: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface OnboardingAccountValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export interface SkillsFormValues {
  primaryRole: string;
  experience: string;
  skills: string[];
  certifications: string;
}

export interface PreferencesFormValues {
  commitment: string;
  minRate: number;
  preferredRate: number;
  timezone: string;
  availability: string;
}

export interface CompanyProfileValues {
  companyName: string;
  website: string;
  industry: string;
  headquarters: string;
  size: string;
  description: string;
}

export interface BillingFormValues {
  plan: string;
  billingEmail: string;
  inviteEmail?: string;
}
