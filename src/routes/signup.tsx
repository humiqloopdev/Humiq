// src/routes/signup.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { SignUpPage } from '@/components/ui/auth';

const signupSearchSchema = z.object({
  role: z.enum(['candidate', 'employer', 'admin']).optional(),
});

export const Route = createFileRoute('/signup')({
  validateSearch: signupSearchSchema,
  beforeLoad: ({ context }) => {
    const user = context.auth?.user;
    if (user) {
      const target = user.role === 'admin' ? '/admin/dashboard' : user.role === 'employer' ? '/employer/ai/dashboard' : '/candidate/dashboard';
      throw redirect({ to: target });
    }
  },
  component: () => {
    const { role } = Route.useSearch();
    return <SignUpPage initialRole={role ?? 'candidate'} />;
  },
});
