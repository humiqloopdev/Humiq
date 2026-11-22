// src/routes/_authenticated/onboarding/account.tsx
import { createFileRoute } from '@tanstack/react-router';
import { OnboardingAccount } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/onboarding/account')({
  component: OnboardingAccount,
});
