// src/components/ui/candidate/interview-room-page.tsx
import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { CheckCircle2 } from 'lucide-react';
import { Alert, Btn, Card, LoadingState } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import { useInterviewSession, type ApiInterviewEnd } from '@/api/candidate/useCandidateQueries';
import { InterviewIntro } from './interview-intro';
import { InterviewRoom } from './interview-room';

export function InterviewRoomPage() {
  const { sessionId } = useParams({ strict: false }) as { sessionId: string };
  const navigate = useNavigate();
  const { data: session, isLoading, isError } = useInterviewSession(sessionId);

  const [started, setStarted] = useState(false);
  const [summary, setSummary] = useState<ApiInterviewEnd | null>(null);

  if (isLoading) return <CandidateShell><LoadingState msg="Loading your interview…" /></CandidateShell>;
  if (isError || !session) return <CandidateShell><Alert v="error">Could not load this interview.</Alert></CandidateShell>;

  const questions = session.questions;

  if (summary || session.status === 'completed' || session.status === 'abandoned') {
    const done = summary?.status ?? session.status;
    return (
      <CandidateShell>
        <Card className="max-w-xl mx-auto text-center">
          <CheckCircle2 size={48} className="mx-auto text-green mb-3" />
          <h2 className="font-display text-2xl font-extrabold text-navy mb-1">
            {done === 'completed' ? 'Interview submitted' : 'Interview ended'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {summary ? `You answered ${summary.answered} of ${summary.total} questions. ` : ''}
            {done === 'completed'
              ? 'Your score will appear on your profile once your answers have been scored.'
              : 'No answers were saved, so this interview was not scored.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Btn v="outline" onClick={() => navigate({ to: '/candidate/interviews' })}>My Interviews</Btn>
            <Btn v="primary" onClick={() => navigate({ to: '/candidate/dashboard' })}>Go to Dashboard</Btn>
          </div>
        </Card>
      </CandidateShell>
    );
  }

  // Show the info/checklist screens before a fresh interview; skip them when resuming one with saved answers.
  if (!started && !questions.some((x) => x.transcript)) {
    return (
      <CandidateShell>
        <InterviewIntro questionCount={questions.length} minutes={questions.length * 4} onNext={() => setStarted(true)} />
      </CandidateShell>
    );
  }

  return <InterviewRoom sessionId={sessionId} questions={questions} onSummary={setSummary} />;
}
