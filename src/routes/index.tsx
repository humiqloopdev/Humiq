// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { LandingPage } from '@/components/ui/auth/landing-page';

export const Route = createFileRoute('/')({
  component: LandingPage,
});
