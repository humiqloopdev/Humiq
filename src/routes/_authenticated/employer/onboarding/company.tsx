// src/routes/_authenticated/employer/onboarding/company.tsx
import { createFileRoute } from '@tanstack/react-router';
import { EmpOnboardingCompany } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/onboarding/company')({
  component: EmpOnboardingCompany,
});
