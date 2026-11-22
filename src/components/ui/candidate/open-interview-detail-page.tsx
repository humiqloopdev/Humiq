// src/components/ui/candidate/open-interview-detail-page.tsx
// Everything a candidate needs to know before starting, plus the email check and the Attend button.
import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Info } from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, Input, LoadingState } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import { useAttendOpenInterview, useOpenInterview } from '@/api/aiInterviews/useOpenInterviews';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { apiErrorMessage } from '@/lib/utils';
import { MetaRow, SkillChips } from './open-interviews-page';

export const DUPLICATE_MESSAGE = 'You already taken the interview';

// Same pragmatic shape check the server applies (local@domain.tld); the server is the real gate.
export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v.trim());

export function OpenInterviewDetailPage({ interviewId }: { interviewId: string }) {
  const navigate = useNavigate();
  const userEmail = useAuthStore((s) => s.user?.email ?? '');
  const { data: i, isLoading, isError } = useOpenInterview(interviewId);
  const attend = useAttendOpenInterview();
  const [email, setEmail] = useState(userEmail);
  const [touched, setTouched] = useState(false);
  const inFlight = useRef(false);

  const emailError = !email.trim() ? 'Enter your email address' : !isValidEmail(email) ? 'Enter a valid email address' : '';

  const onAttend = async () => {
    setTouched(true);
    if (emailError || inFlight.current) return;
    inFlight.current = true;
    try {
      const { sessionId } = await attend.mutateAsync({ id: interviewId, email: email.trim() });
      navigate({ to: '/i/session/$sessionId', params: { sessionId }, search: { preview: undefined } });
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      // The server is the authority; its message is surfaced as a toast (409 = this email already took this interview).
      toast.error(status === 409 ? DUPLICATE_MESSAGE : apiErrorMessage(e));
    } finally {
      inFlight.current = false;
    }
  };

  const back = () => navigate({ to: '/candidate/open-interviews' });

  return (
    <CandidateShell>
      <button type="button" onClick={back} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy mb-4 cursor-pointer"><ArrowLeft size={15} /> Back to open interviews</button>

      {isLoading && <LoadingState msg="Loading interview…" />}
      {isError && <EmptyState icon={<Info size={36} />} title="This interview is no longer open" body="It may have been unpublished or removed by the employer." action={<Btn v="primary" sz="sm" onClick={back}>See open interviews</Btn>} />}

      {i && (
        <div className="max-w-3xl space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-display font-bold text-navy">{i.title}</h1>
                {i.companyName && <p className="text-sm text-gray-400 mt-0.5">{i.companyName}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Badge v="green">Open</Badge>
                {i.matchedSkills.length > 0 && <span className="text-xs font-bold text-green-dk">{i.matchPercent}% match</span>}
              </div>
            </div>
            <div className="mt-3"><MetaRow i={i} /></div>
            {i.description && <p className="text-sm text-gray-700 mt-4 whitespace-pre-line">{i.description}</p>}
            {i.objective && <div className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">What this interview covers</h3><p className="text-sm text-gray-600 whitespace-pre-line">{i.objective}</p></div>}
          </Card>

          <Card>
            <h3 className="font-display font-bold text-navy mb-3">Required skills and experience</h3>
            <SkillChips required={i.requiredSkills} matched={i.matchedSkills} />
            {i.requiredSkills.length > 0 && <p className="text-xs text-gray-400 mt-3">Skills you already have are highlighted in green.</p>}
            <p className="text-sm text-gray-600 mt-3"><b className="text-navy">Experience level:</b> {i.experienceLevel ?? 'Not specified'}</p>
          </Card>

          <Card>
            <h3 className="font-display font-bold text-navy mb-3">Before you start</h3>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-600">
              {i.instructions.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </Card>

          <Card>
            <h3 className="font-display font-bold text-navy mb-1">Attend this interview</h3>
            <p className="text-sm text-gray-500 mb-4">Enter the email address you want to use. Each email address can take this interview once.</p>
            <div className="max-w-md">
              <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
                error={touched ? emailError : undefined} placeholder="you@example.com" autoComplete="email"
                onKeyDown={(e) => { if (e.key === 'Enter') void onAttend(); }} />
            </div>
            {i.alreadyTaken && <div className="mt-3"><Alert v="warning">Your account email has already taken this interview.</Alert></div>}
            <div className="mt-4"><Btn v="primary" sz="lg" loading={attend.isPending} onClick={() => void onAttend()}>Attend Interview →</Btn></div>
          </Card>
        </div>
      )}
    </CandidateShell>
  );
}
