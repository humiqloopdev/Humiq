// src/routes/_authenticated/employer.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/employer')({
  beforeLoad: ({ context }) => {
    if (context.auth?.user?.role !== 'employer') {
      throw redirect({ to: '/' });
    }
  },
  component: () => <Outlet />,
});
