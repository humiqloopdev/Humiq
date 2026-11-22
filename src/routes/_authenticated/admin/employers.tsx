// src/routes/_authenticated/admin/employers.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminEmployers } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/employers')({
  component: AdminEmployers,
});
