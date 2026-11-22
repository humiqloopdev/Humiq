// src/components/ui/auth/signup-page.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Building2, Chrome, Linkedin, User } from 'lucide-react';
import { Btn, Input, Divider, Alert } from '@/components/ui/common';
import { AuthShell } from './auth-shell';
import { signUpSchema, type SignUpInput } from '@/schemas';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';
import { apiErrorMessage } from '@/lib/utils';
import { toast } from '@/store/toastStore';

export function SignUpPage({ initialRole = 'candidate' }: { initialRole?: UserRole }) {
  // Admin accounts cannot be created by self-registration, so an "admin" link falls back to candidate.
  const [role, setRole] = useState<UserRole>(initialRole === 'admin' ? 'candidate' : initialRole);
  const [formError, setFormError] = useState('');
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (v: SignUpInput) => {
    setFormError('');
    try {
      await register({ ...v, role });
      navigate({ to: role === 'candidate' ? '/onboarding/account' : '/employer/onboarding/company' });
    } catch (err: any) {
      const msg = apiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    }
  };

  const roleOptions: { k: UserRole; icon: React.ReactNode; t: string; d: string }[] = [
    { k: 'candidate', icon: <User size={22} />, t: "I'm a Candidate", d: 'Find remote work opportunities' },
    { k: 'employer', icon: <Building2 size={22} />, t: "I'm an Employer", d: 'Hire top global talent' },
  ];

  return (
    <AuthShell wide>
      <h1 className="font-display text-3xl font-extrabold text-navy text-center mb-1">Create Your Account</h1>
      <p className="text-center text-gray-400 text-sm mb-6">Join 50,000+ professionals and 3,200+ companies</p>

      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select your role</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {roleOptions.map((r) => (
          <button
            key={r.k}
            type="button"
            onClick={() => setRole(r.k)}
            className={`rounded-2xl border-2 p-4 text-left transition-all ${role === r.k ? 'border-green bg-green-xlt' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <div className={`mb-2 ${role === r.k ? 'text-green' : 'text-gray-400'}`}>{r.icon}</div>
            <div className="font-bold text-navy text-sm">{r.t}</div>
            <div className="text-xs text-gray-400">{r.d}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Btn v="outline" block icon={<Chrome size={16} />}>Google</Btn>
        <Btn v="outline" block icon={<Linkedin size={16} />}>LinkedIn</Btn>
      </div>
      <Divider text="or sign up with email" />

      {formError && (
        <div className="mt-3">
          <Alert v="error">{formError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-4">
        <Input label="Full Name" placeholder="Arjun Sharma" error={errors.name?.message} {...field('name')} />
        <Input label="Email Address" type="email" placeholder="you@email.com" error={errors.email?.message} {...field('email')} />
        <Input label="Password" type="password" placeholder="Min. 8 characters" error={errors.password?.message} {...field('password')} />
        <Btn v="primary" sz="lg" block loading={isSubmitting} type="submit">
          Create {role === 'candidate' ? 'Candidate' : 'Employer'} Account →
        </Btn>
      </form>

      <p className="text-center mt-5 text-sm text-gray-400">
        Already have an account?&nbsp;
        <span className="text-blue font-semibold cursor-pointer hover:underline" onClick={() => navigate({ to: '/login' })}>
          Log In
        </span>
      </p>
    </AuthShell>
  );
}
