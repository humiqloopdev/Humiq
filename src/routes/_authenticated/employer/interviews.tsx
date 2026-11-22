// src/routes/_authenticated/employer/interviews.tsx
import { createFileRoute } from '@tanstack/react-router';
import { InterviewResultsPage } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/interviews')({
  component: InterviewResultsPage,
});
