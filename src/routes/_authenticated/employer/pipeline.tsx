// src/routes/_authenticated/employer/pipeline.tsx
import { createFileRoute } from '@tanstack/react-router';
import { PipelinePage } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/pipeline')({
  component: PipelinePage,
});
