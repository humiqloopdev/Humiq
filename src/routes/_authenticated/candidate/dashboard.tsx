// src/routes/_authenticated/candidate/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router';
import { CandidateDashboard } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/dashboard')({
  component: CandidateDashboard,
});
