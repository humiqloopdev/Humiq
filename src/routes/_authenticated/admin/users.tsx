// src/routes/_authenticated/admin/users.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AdminUsers } from '@/components/ui/admin';

export const Route = createFileRoute('/_authenticated/admin/users')({
  component: AdminUsers,
});
