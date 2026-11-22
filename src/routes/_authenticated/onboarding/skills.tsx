// src/routes/_authenticated/onboarding/skills.tsx
import { createFileRoute } from '@tanstack/react-router';
import { OnboardingSkills } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/onboarding/skills')({
  component: OnboardingSkills,
});
