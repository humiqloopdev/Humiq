// src/routes/_authenticated/candidate/applications.tsx
import { createFileRoute } from '@tanstack/react-router';
import { ApplicationsPage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/applications')({
  component: ApplicationsPage,
});
