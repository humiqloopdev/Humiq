// src/components/ui/candidate/onboarding-skills.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Btn, Input, Seg, Tag, ObLayout, ObCard, StepBar } from '@/components/ui/common';
import { skillsSchema, type SkillsInput } from '@/schemas';
import { OB_STEPS } from './onboarding-account';
import { Alert } from '@/components/ui/common';
import { apiErrorMessage, useProfile, useUpdateProfile, useUpdateSkills } from '@/api/candidate/useCandidateQueries';

export function OnboardingSkills() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const updateSkills = useUpdateSkills();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SkillsInput>({
    resolver: zodResolver(skillsSchema),
    // Prefilled from the saved profile once it loads.
    values: {
      primaryRole: profile?.primaryRole ?? '',
      experience: profile?.experience ?? '5-8',
      skills: profile?.skills.map((x) => x.name) ?? [],
      certifications: '',
    },
  });
  const [newSkill, setNewSkill] = useState('');
  const skills = watch('skills');
  const experience = watch('experience');

  const onSubmit = async (v: SkillsInput) => {
    try {
      await updateSkills.mutateAsync(v.skills);
      await updateProfile.mutateAsync({ primaryRole: v.primaryRole, experience: v.experience, onboardingStep: 4 });
      navigate({ to: '/onboarding/preferences' });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const addSkill = () => {
    const t = newSkill.trim();
    if (t && !skills.includes(t)) setValue('skills', [...skills, t], { shouldValidate: true });
    setNewSkill('');
  };

  return (
    <ObLayout>
      <ObCard>
        <StepBar steps={OB_STEPS} active={2} />
        <div className="mt-8">
          <h2 className="font-display text-2xl font-extrabold text-navy mb-1">Skills & Expertise</h2>
          <p className="text-sm text-gray-400 mb-8">Help us match you to the right roles</p>
          {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <Input label="Primary Role" error={errors.primaryRole?.message} {...register('primaryRole')} />
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Years of Experience</label>
              <Seg
                options={[['< 2 yrs', '<2'], ['2–5 yrs', '2-5'], ['5–8 yrs', '5-8'], ['8–12 yrs', '8-12'], ['12+ yrs', '12+']]}
                value={experience}
                onChange={(v) => setValue('experience', v, { shouldValidate: true })}
              />
              {errors.experience && <p className="text-xs text-red-600 mt-1">{errors.experience.message}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Top Skills</label>
              <div className="flex flex-wrap gap-2 items-center">
                {skills.map((s) => (
                  <Tag key={s} onRemove={() => setValue('skills', skills.filter((x) => x !== s), { shouldValidate: true })}>
                    {s}
                  </Tag>
                ))}
                <input
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm w-32 outline-none focus:border-green"
                  placeholder="Add skill"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                />
                <Btn v="outline" sz="sm" type="button" onClick={addSkill}>+ Add</Btn>
              </div>
              {errors.skills && <p className="text-xs text-red-600 mt-1">{errors.skills.message}</p>}
            </div>
            <Input label="Certifications (optional)" placeholder="AWS Solutions Architect…" {...register('certifications')} />
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
