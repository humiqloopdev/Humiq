// src/routes/_authenticated/admin/interview.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminInterviewConfig } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/interview')({
  component: AdminInterviewConfig,
});
