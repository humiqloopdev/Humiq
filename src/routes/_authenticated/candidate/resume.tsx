// src/routes/_authenticated/candidate/resume.tsx
import { createFileRoute } from '@tanstack/react-router';
import { ResumePage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/resume')({
  component: ResumePage,
});
