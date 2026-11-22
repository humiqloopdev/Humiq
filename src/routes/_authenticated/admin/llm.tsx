// src/routes/_authenticated/admin/llm.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminLlmSettings } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/llm')({
  component: AdminLlmSettings,
});
