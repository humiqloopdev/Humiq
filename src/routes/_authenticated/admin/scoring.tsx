// src/routes/_authenticated/admin/scoring.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminScoringModel } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/scoring')({
  component: AdminScoringModel,
});
