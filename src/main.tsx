import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import './index.css';
import { routeTree } from './routeTree.gen';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/common';

// Router instance — auth state is injected via context so route loaders/guards can read it.
const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // populated by <App /> via router.update / InnerApp below
  },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function InnerApp() {
  const auth = useAuthStore();
  router.update({ context: { auth } });
  return <RouterProvider router={router} context={{ auth }} />;
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <InnerApp />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>
);
