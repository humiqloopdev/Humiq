// src/routes/_authenticated/admin.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: ({ context }) => {
    if (context.auth?.user?.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: () => <Outlet />,
});
