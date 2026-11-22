// src/routes/_authenticated/employer/payroll.tsx
import { createFileRoute } from '@tanstack/react-router';
import { PayrollPage } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/payroll')({
  component: PayrollPage,
});
