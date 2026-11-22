// src/routes/_authenticated/candidate/profile.tsx
import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/profile')({
  component: ProfilePage,
});
