// src/components/ui/candidate/onboarding-account.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert, Btn, Input, ObLayout, ObCard, StepBar } from '@/components/ui/common';
import { onboardingAccountSchema, type OnboardingAccountInput } from '@/schemas';
import { apiErrorMessage, useProfile, useUpdateProfile } from '@/api/candidate/useCandidateQueries';

export const OB_STEPS = ['Account', 'Resume', 'Skills', 'Preferences', 'Interview'];

export function OnboardingAccount() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingAccountInput>({
    resolver: zodResolver(onboardingAccountSchema),
    // Prefilled from the saved profile once it loads.
    values: { firstName: profile?.firstName ?? '', lastName: profile?.lastName ?? '', phone: profile?.phone ?? '' },
  });

  const onSubmit = async (v: OnboardingAccountInput) => {
    try {
      await update.mutateAsync({ ...v, onboardingStep: 2 });
      navigate({ to: '/onboarding/resume' });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <ObLayout>
      <ObCard>
        <StepBar steps={OB_STEPS} active={0} />
        <div className="mt-8">
          <h2 className="font-display text-2xl font-extrabold text-navy mb-1">Set up your account</h2>
          <p className="text-sm text-gray-400 mb-8">Takes about 2 minutes</p>
          {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="First Name" placeholder="Arjun" error={errors.firstName?.message} {...register('firstName')} />
              <Input label="Last Name" placeholder="Sharma" error={errors.lastName?.message} {...register('lastName')} />
            </div>
            <Input label="Email" type="email" value={profile?.email ?? ''} readOnly disabled />
            <Input label="Phone" placeholder="+91 98765 43210" error={errors.phone?.message} {...register('phone')} />
            <div className="flex gap-3 mt-4">
              <Btn v="outline" sz="lg" type="button" onClick={() => window.history.back()}>← Back</Btn>
              <Btn v="primary" sz="lg" block type="submit" loading={isSubmitting}>Save & Continue →</Btn>
            </div>
          </form>
        </div>
      </ObCard>
    </ObLayout>
  );
}
