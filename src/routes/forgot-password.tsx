// src/routes/forgot-password.tsx
import { createFileRoute } from '@tanstack/react-router';
import { ForgotPasswordPage } from '@/components/ui/auth';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});
