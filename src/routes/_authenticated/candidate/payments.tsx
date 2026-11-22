// src/routes/_authenticated/candidate/payments.tsx
import { createFileRoute } from '@tanstack/react-router';
import { PaymentsPage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/payments')({
  component: PaymentsPage,
});
