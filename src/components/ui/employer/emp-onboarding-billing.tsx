// src/components/ui/employer/emp-onboarding-billing.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert, Btn, Input, ObLayout, ObCard, StepBar } from '@/components/ui/common';
import { useCompany, useInviteTeam, useSaveCompany } from '@/api/employer/useEmployerQueries';
import { apiErrorMessage } from '@/lib/utils';
import { billingSchema, type BillingInput } from '@/schemas';
import { EMP_STEPS } from './emp-onboarding-company';

export function EmpOnboardingBilling() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const { data: company } = useCompany();
  const save = useSaveCompany();
  const invite = useInviteTeam();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BillingInput>({
    resolver: zodResolver(billingSchema),
    values: { plan: company?.plan ?? 'pro', billingEmail: company?.billingEmail ?? '', inviteEmail: '' },
  });
  const plan = watch('plan');

  const plans = [
    { k: 'starter', name: 'Starter', price: '$299', per: '/mo', feats: ['3 active roles', 'Basic candidate pool', 'AI search', '90-day history'] },
    { k: 'pro', name: 'Pro ⭐', price: '$699', per: '/mo', feats: ['10 active roles', 'Full candidate pool', 'Advanced analytics', 'API access'], featured: true },
    { k: 'enterprise', name: 'Enterprise', price: 'Custom', per: '', feats: ['Unlimited roles', 'Dedicated support', 'SSO + Custom config', 'Contract pricing'] },
  ];

  const onSubmit = async (v: BillingInput) => {
    try {
      await save.mutateAsync({ plan: v.plan, billingEmail: v.billingEmail });
      navigate({ to: '/employer/ai/dashboard' });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const sendInvite = async () => {
    const email = (getValues('inviteEmail') ?? '').trim();
    if (!email) return;
    try {
      const res = await invite.mutateAsync({ email, role: 'recruiter' });
      setInviteNote(`Invitation created for ${email}. There is no email service yet, so share this code with them: ${res.token}`);
      setError('');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <ObLayout>
      <ObCard wide>
        <StepBar steps={EMP_STEPS} active={1} />
        <div className="mt-8">
          <h2 className="font-display text-2xl font-extrabold text-navy mb-1">Team & Billing</h2>
          <p className="text-sm text-gray-400 mb-8">Choose a plan and invite your hiring team</p>
          {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
          {inviteNote && <div className="mb-4"><Alert v="success">{inviteNote}</Alert></div>}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {plans.map((p) => (
                <button
                  key={p.k}
                  type="button"
                  onClick={() => setValue('plan', p.k, { shouldValidate: true })}
                  className={`rounded-2xl border-2 p-5 text-center transition-all ${plan === p.k ? 'border-green bg-green-xlt' : p.featured ? 'border-purple-lt bg-purple-lt/30' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="font-display font-bold text-navy mb-2">{p.name}</div>
                  <div className="text-2xl font-extrabold text-navy font-display mb-0.5">{p.price}<span className="text-xs font-normal text-gray-400">{p.per}</span></div>
                  <div className="mt-3 space-y-1">{p.feats.map((f) => <div key={f} className="text-xs text-gray-500">{f}</div>)}</div>
                </button>
              ))}
            </div>
            <p className="text-center text-sm font-bold text-green">✓ 14-DAY FREE TRIAL · No credit card required</p>
            <Input label="Billing Email" error={errors.billingEmail?.message} {...register('billingEmail')} />
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Invite Team Members (optional)</label>
              <div className="flex gap-3">
                <input
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-green"
                  placeholder="teammate@company.com"
                  {...register('inviteEmail')}
                />
                <Btn v="outline" type="button" loading={invite.isPending} onClick={sendInvite}>+ Invite</Btn>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <Btn v="outline" sz="lg" type="button" onClick={() => window.history.back()}>← Back</Btn>
              <Btn v="navy" sz="lg" block type="submit" loading={isSubmitting}>Start Free Trial →</Btn>
            </div>
          </form>
        </div>
      </ObCard>
    </ObLayout>
  );
}
