// src/routes/_authenticated/admin/compliance.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminCompliance } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/compliance')({
  component: AdminCompliance,
});
