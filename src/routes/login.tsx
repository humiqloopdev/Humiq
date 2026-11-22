// src/routes/login.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { LoginPage } from '@/components/ui/auth';

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context }) => {
    const user = context.auth?.user;
    if (user) {
      const target = user.role === 'admin' ? '/admin/dashboard' : user.role === 'employer' ? '/employer/ai/dashboard' : '/candidate/dashboard';
      throw redirect({ to: target });
    }
  },
  component: LoginPage,
});
