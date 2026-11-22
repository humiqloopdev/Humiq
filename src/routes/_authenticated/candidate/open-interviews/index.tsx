// src/routes/_authenticated/candidate/open-interviews/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { OpenInterviewsPage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/open-interviews/')({
  component: OpenInterviewsPage,
});
