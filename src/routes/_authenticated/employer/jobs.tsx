// src/routes/_authenticated/employer/jobs.tsx
import { createFileRoute } from '@tanstack/react-router';
import { JobPostingsPage } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/jobs')({
  component: JobPostingsPage,
});
