// src/routes/_authenticated/employer/analytics.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AnalyticsPage } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/analytics')({
  component: AnalyticsPage,
});
