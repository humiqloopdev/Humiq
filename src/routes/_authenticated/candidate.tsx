// src/routes/_authenticated/candidate.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/candidate')({
  beforeLoad: ({ context }) => {
    if (context.auth?.user?.role !== 'candidate') {
      throw redirect({ to: '/' });
    }
  },
  component: () => <Outlet />,
});
