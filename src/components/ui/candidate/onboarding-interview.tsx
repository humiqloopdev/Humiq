// src/components/ui/candidate/onboarding-interview.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Clapperboard, ListChecks, Settings2 } from 'lucide-react';
import { Alert, Btn, ObLayout, ObCard, StepBar } from '@/components/ui/common';
import { OB_STEPS } from './onboarding-account';
import { apiErrorMessage, useStartInterview, useUpdateProfile } from '@/api/candidate/useCandidateQueries';

export function OnboardingInterview() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const start = useStartInterview();
  const update = useUpdateProfile();

  const begin = async () => {
    try {
      await update.mutateAsync({ onboardingStep: 6, onboardingCompleted: true });
      const session = await start.mutateAsync(undefined);
      navigate({ to: '/candidate/interview/$sessionId', params: { sessionId: session.id } });
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not start the interview'));
    }
  };

  const skip = async () => {
    try {
      await update.mutateAsync({ onboardingStep: 6, onboardingCompleted: true });
      navigate({ to: '/candidate/dashboard' });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <ObLayout>
      <ObCard>
        <StepBar steps={OB_STEPS} active={4} />
        <div className="mt-8 text-center">
          <Clapperboard size={56} className="mx-auto text-green mb-4" strokeWidth={1.5} />
          <h2 className="font-display text-2xl font-extrabold text-navy mb-2">You're Almost There!</h2>
          <p className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">Answer a short written interview to unlock your job matches</p>
          {error && <div className="mb-4 text-left"><Alert v="error">{error}</Alert></div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-left">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h4 className="font-bold text-navy mb-3 flex items-center gap-2"><ListChecks size={16} className="text-blue" /> What to Expect</h4>
              {['5 questions on your experience', 'Type your answers in your own words', 'Answers save as you move on', 'You can retake it later', 'Scores appear on your profile once reviewed'].map((it) => (
                <p key={it} className="text-xs text-gray-600 py-1">{it}</p>
              ))}
            </div>
            <div className="bg-green-xlt border border-green-lt rounded-2xl p-5">
              <h4 className="font-bold text-navy mb-3 flex items-center gap-2"><Settings2 size={16} className="text-green" /> Tips</h4>
              {['Give specific examples', 'Explain your decisions and trade-offs', 'There is no time limit'].map((it) => (
                <p key={it} className="text-xs text-gray-600 py-1">{it}</p>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <Btn v="outline" sz="lg" loading={update.isPending && !start.isPending} onClick={skip}>Skip for now</Btn>
            <Btn v="primary" sz="lg" loading={start.isPending} onClick={begin} icon={<Clapperboard size={15} />}>Start →</Btn>
          </div>
        </div>
      </ObCard>
    </ObLayout>
  );
}
