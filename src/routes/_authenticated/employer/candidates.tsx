// src/routes/_authenticated/employer/candidates.tsx
import { createFileRoute } from '@tanstack/react-router';
import { CandidatePoolPage } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/candidates')({
  component: CandidatePoolPage,
});
