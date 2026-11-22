// src/components/ui/auth/forgot-password-page.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Btn, Input, Alert } from '@/components/ui/common';
import { AuthShell } from './auth-shell';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/schemas';
import { AuthAPI } from '@/api/auth';
import { toast } from '@/store/toastStore';
import { apiErrorMessage } from '@/lib/utils';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (v: ForgotPasswordInput) => {
    setFormError('');
    try {
      await AuthAPI.forgotPassword(v.email);
      setSent(true);
    } catch (err: any) {
      const msg = apiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-extrabold text-navy text-center mb-1">Reset Password</h1>
      <p className="text-center text-gray-400 text-sm mb-6">We'll email you a link to reset your password</p>

      {sent ? (
        <Alert v="success">If an account exists for that email, a reset link is on its way.</Alert>
      ) : (
        <>
          {formError && (
            <div className="mb-3">
              <Alert v="error">{formError}</Alert>
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input label="Email Address" type="email" placeholder="you@email.com" error={errors.email?.message} {...register('email')} />
            <Btn v="primary" sz="lg" block loading={isSubmitting} type="submit">
              Send Reset Link →
            </Btn>
          </form>
        </>
      )}

      <p className="text-center mt-5 text-sm text-gray-400">
        Remembered it?&nbsp;
        <span className="text-blue font-semibold cursor-pointer hover:underline" onClick={() => navigate({ to: '/login' })}>
          Log In
        </span>
      </p>
    </AuthShell>
  );
}
