// src/routes/_authenticated/candidate/interviews.tsx
import { createFileRoute } from '@tanstack/react-router';
import { InterviewsPage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/interviews')({
  component: InterviewsPage,
});
