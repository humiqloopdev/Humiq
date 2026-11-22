// src/routes/_authenticated/onboarding/resume.tsx
import { createFileRoute } from '@tanstack/react-router';
import { OnboardingResume } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/onboarding/resume')({
  component: OnboardingResume,
});
