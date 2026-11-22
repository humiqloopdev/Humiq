// src/routes/_authenticated/employer/team.tsx
import { createFileRoute } from '@tanstack/react-router';
import { TeamPage } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/team')({
  component: TeamPage,
});
