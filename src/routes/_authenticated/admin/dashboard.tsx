// src/routes/_authenticated/admin/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminOverview } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/dashboard')({
  component: AdminOverview,
});
