// src/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { useAuthStore } from '@/store/authStore';

interface RouterContext {
  auth: ReturnType<typeof useAuthStore.getState> | undefined;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return <Outlet />;
}
