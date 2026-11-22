// src/routes/_authenticated/employer/onboarding/billing.tsx
import { createFileRoute } from '@tanstack/react-router';
import { EmpOnboardingBilling } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/onboarding/billing')({
  component: EmpOnboardingBilling,
});
