// src/routes/_authenticated/admin/settings.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminSettings } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: AdminSettings,
});
