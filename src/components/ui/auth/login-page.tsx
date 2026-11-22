// src/components/ui/auth/login-page.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Building2, Chrome, Linkedin, ShieldCheck, User, Zap as ZapIcon } from 'lucide-react';
import { Btn, Input, Divider, Alert } from '@/components/ui/common';
import { AuthShell } from './auth-shell';
import { loginSchema, type LoginInput } from '@/schemas';
import { useAuthStore } from '@/store/authStore';
import { apiErrorMessage } from '@/lib/utils';
import { toast } from '@/store/toastStore';

const DEMO_USERS = [
  { role: 'Admin', email: 'ADMIN', password: 'admin123', icon: <ShieldCheck size={14} />, color: 'bg-purple-lt text-purple border-purple/20' },
  { role: 'Employer', email: 'employer@acmecorp.com', password: 'employer123', icon: <Building2 size={14} />, color: 'bg-blue-lt text-blue border-blue/20' },
  { role: 'Candidate', email: 'arjun@email.com', password: 'candidate123', icon: <User size={14} />, color: 'bg-green-xlt text-green border-green-lt' },
];

function DemoBanner({ onFill }: { onFill: (email: string, password: string) => void }) {
  return (
    <div className="mb-5 rounded-2xl border border-amber/30 bg-amber-lt/40 p-4">
      <p className="text-xs font-bold text-amber uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <ZapIcon size={12} /> Demo Accounts — click to fill
      </p>
      <div className="flex flex-col gap-2">
        {DEMO_USERS.map((u) => (
          <button
            key={u.role}
            type="button"
            onClick={() => onFill(u.email, u.password)}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-100 ${u.color}`}
          >
            <span className="flex-shrink-0">{u.icon}</span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-xs">{u.role}</span>
              <span className="text-xs opacity-70 ml-2">{u.email}</span>
            </div>
            <span className="text-xs font-mono opacity-60 flex-shrink-0">{u.password}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function LoginPage() {
  const [formError, setFormError] = useState('');
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (v: LoginInput) => {
    setFormError('');
    try {
      const u = await login(v.email, v.password);
      if (u.role === 'candidate') navigate({ to: '/candidate/dashboard' });
      else if (u.role === 'employer') navigate({ to: '/employer/ai/dashboard' });
      else navigate({ to: '/admin/dashboard' });
    } catch (err: any) {
      const msg = apiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    }
  };

  const fillDemo = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
  };

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-extrabold text-navy text-center mb-1">Welcome Back</h1>
      <p className="text-center text-gray-400 text-sm mb-6">Sign in to your Humiq Loop account</p>

      <DemoBanner onFill={fillDemo} />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Btn v="outline" block icon={<Chrome size={16} />}>Google</Btn>
        <Btn v="outline" block icon={<Linkedin size={16} />}>LinkedIn</Btn>
      </div>
      <Divider text="or sign in with email" />

      {formError && (
        <div className="mt-3">
          <Alert v="error">{formError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-4">
        <Input label="Username or Email" type="text" placeholder="ADMIN" error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" placeholder="Your password" error={errors.password?.message} {...register('password')} />
        <div className="text-right -mt-1">
          <span className="text-sm text-blue cursor-pointer hover:underline" onClick={() => navigate({ to: '/forgot-password' })}>
            Forgot password?
          </span>
        </div>
        <Btn v="primary" sz="lg" block loading={isSubmitting} type="submit">
          Sign In →
        </Btn>
      </form>

      <p className="text-center mt-5 text-sm text-gray-400">
        No account?&nbsp;
        <span className="text-blue font-semibold cursor-pointer hover:underline" onClick={() => navigate({ to: '/signup' })}>
          Sign Up
        </span>
      </p>
    </AuthShell>
  );
}
