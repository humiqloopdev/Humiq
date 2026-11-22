// src/components/ui/employer/emp-onboarding-company.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert, Btn, Input, Seg, Textarea, ObLayout, ObCard, StepBar } from '@/components/ui/common';
import { useCompany, useSaveCompany } from '@/api/employer/useEmployerQueries';
import { apiErrorMessage } from '@/lib/utils';
import { companyProfileSchema, type CompanyProfileInput } from '@/schemas';

export const EMP_STEPS = ['Company Profile', 'Team & Billing'];

export function EmpOnboardingCompany() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { data: company } = useCompany();
  const save = useSaveCompany();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompanyProfileInput>({
    resolver: zodResolver(companyProfileSchema),
    // Prefilled from the saved company once it loads (blank on first visit).
    values: {
      companyName: company?.companyName ?? '',
      website: company?.website ?? '',
      industry: company?.industry ?? '',
      headquarters: company?.headquarters ?? '',
      size: company?.size ?? '51-200',
      description: company?.description ?? '',
    },
  });
  const size = watch('size');

  const onSubmit = async (v: CompanyProfileInput) => {
    try {
      await save.mutateAsync(v);
      navigate({ to: '/employer/onboarding/billing' });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <ObLayout>
      <ObCard>
        <StepBar steps={EMP_STEPS} active={0} />
        <div className="mt-8">
          <h2 className="font-display text-2xl font-extrabold text-navy mb-1">Company Profile</h2>
          <p className="text-sm text-gray-400 mb-8">This information helps candidates trust and discover your company</p>
          {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Company Name" error={errors.companyName?.message} {...register('companyName')} />
              <Input label="Website" error={errors.website?.message} {...register('website')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Industry" error={errors.industry?.message} {...register('industry')} />
              <Input label="Headquarters" error={errors.headquarters?.message} {...register('headquarters')} />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Company Size</label>
              <Seg
                options={[['1–10', '1-10'], ['11–50', '11-50'], ['51–200', '51-200'], ['201–1000', '201-1000'], ['1000+', '1000+']]}
                value={size}
                onChange={(v) => setValue('size', v, { shouldValidate: true })}
              />
            </div>
            <Textarea label="Company Description" rows={3} error={errors.description?.message} {...register('description')} />
            <div className="flex gap-3 mt-2">
              <Btn v="outline" sz="lg" type="button" onClick={() => window.history.back()}>← Back</Btn>
              <Btn v="navy" sz="lg" block type="submit" loading={isSubmitting}>Save & Continue →</Btn>
            </div>
          </form>
        </div>
      </ObCard>
    </ObLayout>
  );
}
