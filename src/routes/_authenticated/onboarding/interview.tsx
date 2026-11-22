// src/routes/_authenticated/onboarding/interview.tsx
import { createFileRoute } from '@tanstack/react-router';
import { OnboardingInterview } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/onboarding/interview')({
  component: OnboardingInterview,
});
