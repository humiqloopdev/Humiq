// src/routes/_authenticated/admin/jobs.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminJobs } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/jobs')({
  component: AdminJobs,
});
