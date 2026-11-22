// src/components/ui/candidate/onboarding-preferences.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Btn, Input, Seg, ObLayout, ObCard, StepBar } from '@/components/ui/common';
import { preferencesSchema, type PreferencesInput } from '@/schemas';
import { OB_STEPS } from './onboarding-account';
import { Alert } from '@/components/ui/common';
import { apiErrorMessage, useUpdatePreferences, useUpdateProfile } from '@/api/candidate/useCandidateQueries';

export function OnboardingPreferences() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const updatePrefs = useUpdatePreferences();
  const updateProfile = useUpdateProfile();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PreferencesInput>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      commitment: 'full-time',
      minRate: 80,
      preferredRate: 100,
      timezone: 'Chennai, India (IST — UTC+5:30)',
      availability: 'immediate',
    },
  });
  const commitment = watch('commitment');
  const availability = watch('availability');

  const onSubmit = async (v: PreferencesInput) => {
    try {
      await updatePrefs.mutateAsync(v);
      await updateProfile.mutateAsync({ onboardingStep: 5 });
      navigate({ to: '/onboarding/interview' });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <ObLayout>
      <ObCard>
        <StepBar steps={OB_STEPS} active={3} />
        <div className="mt-8">
          <h2 className="font-display text-2xl font-extrabold text-navy mb-1">Work Preferences</h2>
          <p className="text-sm text-gray-400 mb-8">We'll prioritise the best-fit roles for you</p>
          {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Commitment Type</label>
              <Seg
                options={[['Full-time', 'full-time'], ['Part-time', 'part-time'], ['Contract', 'contract'], ['Hourly', 'hourly']]}
                value={commitment}
                onChange={(v) => setValue('commitment', v, { shouldValidate: true })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Minimum ($/hr)" type="number" error={errors.minRate?.message} {...register('minRate')} />
              <Input label="Preferred ($/hr)" type="number" error={errors.preferredRate?.message} {...register('preferredRate')} />
            </div>
            <Input label="Timezone" error={errors.timezone?.message} {...register('timezone')} />
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Availability</label>
              <Seg
                options={[['Immediate', 'immediate'], ['< 2 weeks', '2w'], ['1 month', '1m'], ['2+ months', '2m+']]}
                value={availability}
                onChange={(v) => setValue('availability', v, { shouldValidate: true })}
              />
            </div>
            <div className="flex gap-3 mt-2">
              <Btn v="outline" sz="lg" type="button" onClick={() => window.history.back()}>← Back</Btn>
              <Btn v="primary" sz="lg" block type="submit" loading={isSubmitting}>Save & Continue →</Btn>
            </div>
          </form>
        </div>
      </ObCard>
    </ObLayout>
  );
}
