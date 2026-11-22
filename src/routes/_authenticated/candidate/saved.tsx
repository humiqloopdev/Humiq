// src/routes/_authenticated/candidate/saved.tsx
import { createFileRoute } from '@tanstack/react-router';
import { SavedJobsPage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/saved')({
  component: SavedJobsPage,
});
