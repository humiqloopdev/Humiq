// src/routes/_authenticated/employer/ai-search.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AiSearchPage } from '@/components/ui/employer';

export const Route = createFileRoute('/_authenticated/employer/ai-search')({
  component: AiSearchPage,
});
