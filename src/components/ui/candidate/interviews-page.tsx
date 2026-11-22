// src/components/ui/candidate/interviews-page.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Video, Calendar, TrendingUp, Award } from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, LoadingState, MetricCard, ProgressBar } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import { apiErrorMessage, useInterviewHistory, useInterviewResults, useStartInterview, type ApiInterview } from '@/api/candidate/useCandidateQueries';
import { initials } from '@/lib/utils';

const CATEGORY_LABEL: Record<string, string> = {
  technical_depth: 'Technical Depth', communication: 'Communication',
  system_design: 'System Design', problem_solving: 'Problem Solving',
};

const STATUS: Record<string, { label: string; badge: 'green' | 'blue' | 'amber' | 'gray' }> = {
  completed: { label: 'Completed', badge: 'green' },
  scheduled: { label: 'Scheduled', badge: 'blue' },
  in_progress: { label: 'In Progress', badge: 'amber' },
  abandoned: { label: 'Abandoned', badge: 'gray' },
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function Breakdown({ id }: { id: string }) {
  const { data } = useInterviewResults(id);
  if (!data?.scores.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-2 px-1">
      {data.scores.map((b) => <ProgressBar key={b.category} label={CATEGORY_LABEL[b.category] ?? b.category} value={b.score} max={100} />)}
    </div>
  );
}

function when(iv: ApiInterview) {
  const iso = iv.completed_at ?? iv.scheduled_at;
  return iso ? dateTime(iso) : 'Date not set';
}

export function InterviewsPage() {
  const [tab, setTab] = useState<'all' | 'upcoming' | 'completed'>('all');
  const { data: interviews = [], isLoading, isError } = useInterviewHistory();
  const navigate = useNavigate();
  const start = useStartInterview();
  const [error, setError] = useState('');

  // Starts (or resumes) an interview, then opens the interview room.
  const begin = (jobId?: string | null) =>
    start.mutateAsync(jobId ?? undefined)
      .then((session) => navigate({ to: '/candidate/interview/$sessionId', params: { sessionId: session.id } }))
      .catch((e) => setError(apiErrorMessage(e, 'Could not start the interview')));

  // Scheduled / in-progress interviews already exist: open that one rather than creating another.
  const open = (id: string) => navigate({ to: '/candidate/interview/$sessionId', params: { sessionId: id } });

  const filtered = interviews.filter((iv) => {
    if (tab === 'upcoming') return ['scheduled', 'in_progress'].includes(iv.status);
    if (tab === 'completed') return iv.status === 'completed';
    return true;
  });

  const scored = interviews.filter((iv) => iv.overall_score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, iv) => s + (iv.overall_score ?? 0), 0) / scored.length) : null;
  const best = scored.reduce<ApiInterview | null>((b, iv) => (!b || (iv.overall_score ?? 0) > (b.overall_score ?? 0) ? iv : b), null);
  const upcoming = interviews.filter((iv) => ['scheduled', 'in_progress'].includes(iv.status)).length;

  const metrics = [
    { icon: <Video size={20} />, value: String(interviews.length), label: 'Total Interviews', delta: `${interviews.filter((i) => i.status === 'completed').length} completed`, up: true, accent: 'navy' as const },
    { icon: <Award size={20} />, value: avg == null ? '—' : `${avg}%`, label: 'Avg AI Score', delta: `${scored.length} scored`, up: true, accent: 'green' as const },
    { icon: <Calendar size={20} />, value: String(upcoming), label: 'Upcoming', delta: 'Scheduled or in progress', up: true, accent: 'blue' as const },
    { icon: <TrendingUp size={20} />, value: best ? `${best.overall_score}%` : '—', label: 'Best Score', delta: best?.company_name ?? 'No scores yet', up: true, accent: 'amber' as const },
  ];

  return (
    <CandidateShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
        <h1 className="text-2xl font-display font-bold text-navy">My Interviews</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your AI interview history</p>
        </div>
        <Btn v="primary" sz="sm" icon={<Video size={14} />} loading={start.isPending && !start.variables} onClick={() => begin()} className="self-start">
          Start AI Interview
        </Btn>
      </div>
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}

      {isLoading && <LoadingState msg="Loading interviews…" />}
      {isError && <Alert v="error">Could not load interviews. Is the backend running?</Alert>}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          <div className="flex gap-2 mb-5">
            {([['all', 'All'], ['upcoming', 'Upcoming'], ['completed', 'Completed']] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                  tab === k ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-navy hover:text-navy'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-5">
            {filtered.map((iv) => {
              const s = STATUS[iv.status] ?? STATUS.abandoned;
              const company = iv.company_name ?? 'General';
              return (
                <Card key={iv.id}>
                  <div className="flex items-start gap-4 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-navy-lt flex items-center justify-center font-display font-extrabold text-navy text-sm flex-shrink-0">
                      {initials(company)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-display font-bold text-navy">{iv.title ?? 'AI Screening Interview'}</span>
                        <Badge v={s.badge}>{s.label}</Badge>
                      </div>
                      <div className="text-sm text-gray-500 mb-1">{company}</div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Video size={11} />AI Interview</span>
                        <span className="flex items-center gap-1"><Calendar size={11} />{when(iv)}</span>
                      </div>
                    </div>
                    {iv.overall_score != null && (
                      <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border-2 flex-shrink-0 ${
                        iv.overall_score >= 90 ? 'border-green bg-green-xlt text-green'
                          : iv.overall_score >= 80 ? 'border-blue bg-blue-lt text-blue'
                            : 'border-amber bg-amber-lt text-amber'
                      }`}>
                        <span className="text-lg font-display font-extrabold leading-none">{Math.round(iv.overall_score)}</span>
                        <span className="text-[10px]">/100</span>
                      </div>
                    )}
                  </div>
                  {iv.overall_score != null && <Breakdown id={iv.id} />}
                  {iv.status === 'completed' && iv.overall_score == null && (
                    <p className="text-xs text-gray-400">Awaiting AI scoring.</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {iv.status === 'in_progress' && <Btn v="primary" sz="sm" onClick={() => open(iv.id)}>Continue</Btn>}
                    {iv.status === 'scheduled' && <Btn v="primary" sz="sm" icon={<Video size={13} />} onClick={() => open(iv.id)}>Start Interview</Btn>}
                    {(iv.status === 'completed' || iv.status === 'abandoned') && <Btn v="outline" sz="sm" loading={start.isPending && start.variables === (iv.job_id ?? undefined)} onClick={() => begin(iv.job_id)}>Retake</Btn>}
                  </div>
                </Card>
              );
            })}
          </div>

          {filtered.length === 0 && <EmptyState icon={<Video size={36} />} title="No interviews here" />}
        </>
      )}
    </CandidateShell>
  );
}
