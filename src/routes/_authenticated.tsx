// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Spinner } from '@/components/ui/common';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (context.auth?.loading) return; // still restoring session, let component show spinner
    if (!context.auth?.user) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { auth } = Route.useRouteContext();
  if (auth?.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size={40} />
      </div>
    );
  }
  return <Outlet />;
}
