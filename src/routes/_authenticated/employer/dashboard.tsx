// src/routes/_authenticated/employer/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router';
import { EmployerDashboard } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/dashboard')({
  component: EmployerDashboard,
});
