// src/routes/_authenticated/onboarding/preferences.tsx
import { createFileRoute } from '@tanstack/react-router';
import { OnboardingPreferences } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/onboarding/preferences')({
  component: OnboardingPreferences,
});
