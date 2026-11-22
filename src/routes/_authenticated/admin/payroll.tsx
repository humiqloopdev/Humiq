// src/routes/_authenticated/admin/payroll.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminPayroll } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/payroll')({
  component: AdminPayroll,
});
