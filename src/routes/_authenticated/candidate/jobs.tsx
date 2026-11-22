// src/routes/_authenticated/candidate/jobs.tsx
import { createFileRoute } from '@tanstack/react-router';
import { JobDiscoveryPage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/jobs')({
  component: JobDiscoveryPage,
});
