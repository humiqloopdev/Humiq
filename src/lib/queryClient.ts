// src/lib/queryClient.ts
// One shared cache, so it can be emptied on sign-in and sign-out and one user's data never shows for the next.
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
