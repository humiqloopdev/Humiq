// src/routes/_authenticated/onboarding.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/onboarding')({
  beforeLoad: ({ context }) => {
    if (context.auth?.user?.role !== 'candidate') {
      throw redirect({ to: '/' });
    }
  },
  component: () => <Outlet />,
});
