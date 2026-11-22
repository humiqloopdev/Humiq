// src/components/ui/employer/interview-results-page.tsx
import { useState } from 'react';
import { Award, Calendar, TrendingUp, Video } from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, LoadingState, MetricCard, Modal, ProgressBar } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { useInterviewDetail, useInterviewResults, type EmpInterview } from '@/api/employer/useEmployerQueries';
import { initials } from '@/lib/utils';

const CATEGORY_LABEL: Record<string, string> = {
  technical_depth: 'Technical Depth', communication: 'Communication', system_design: 'System Design', problem_solving: 'Problem Solving',
};
const STATUS: Record<string, { label: string; badge: 'green' | 'blue' | 'amber' | 'gray' }> = {
  completed: { label: 'Completed', badge: 'green' }, scheduled: { label: 'Scheduled', badge: 'blue' },
  in_progress: { label: 'In Progress', badge: 'amber' }, abandoned: { label: 'Abandoned', badge: 'gray' },
};
const dateTime = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function ReportModal({ iv, onClose }: { iv: EmpInterview; onClose: () => void }) {
  const { data, isLoading } = useInterviewDetail(iv.id);
  return (
    <Modal open onClose={onClose} title={`${iv.candidate} · ${iv.job_title}`}>
      {isLoading || !data ? <LoadingState /> : (
        <div className="flex flex-col gap-4 text-sm">
          {data.overallScore != null && <div className="text-gray-600">Overall score: <b className="text-green">{Math.round(data.overallScore)}/100</b></div>}
          {data.scores.length > 0 && (
            <div className="grid gap-3">{data.scores.map((s) => <ProgressBar key={s.category} label={CATEGORY_LABEL[s.category] ?? s.category} value={s.score} max={100} />)}</div>
          )}
          <div>
            <h4 className="font-bold text-navy mb-2">Answers</h4>
            {data.answers.map((a) => (
              <div key={a.position} className="mb-3">
                <div className="text-xs font-semibold text-gray-500">{a.position}. {a.question_text}</div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 mt-1 text-xs text-gray-700 whitespace-pre-wrap">{a.transcript ?? <i className="text-gray-400">No answer</i>}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function InterviewResultsPage() {
  const [tab, setTab] = useState<'all' | 'completed' | 'upcoming'>('all');
  const [open, setOpen] = useState<EmpInterview | null>(null);
  const { data: interviews = [], isLoading, isError } = useInterviewResults();

  const filtered = interviews.filter((iv) => {
    if (tab === 'completed') return iv.status === 'completed';
    if (tab === 'upcoming') return ['scheduled', 'in_progress'].includes(iv.status);
    return true;
  });
  const scored = interviews.filter((iv) => iv.overall_score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, iv) => s + (iv.overall_score ?? 0), 0) / scored.length) : null;
  const top = scored.reduce<EmpInterview | null>((b, iv) => (!b || (iv.overall_score ?? 0) > (b.overall_score ?? 0) ? iv : b), null);

  const metrics = [
    { icon: <Video size={20} />, value: String(interviews.length), label: 'Total Interviews', delta: `${interviews.filter((i) => i.status === 'completed').length} completed`, up: true, accent: 'navy' as const },
    { icon: <Award size={20} />, value: avg == null ? '—' : `${avg}%`, label: 'Avg AI Score', delta: `${scored.length} scored`, up: true, accent: 'green' as const },
    { icon: <Calendar size={20} />, value: String(interviews.filter((i) => ['scheduled', 'in_progress'].includes(i.status)).length), label: 'Upcoming', delta: 'Scheduled or in progress', up: true, accent: 'blue' as const },
    { icon: <TrendingUp size={20} />, value: top ? `${Math.round(top.overall_score!)}%` : '—', label: 'Top Score', delta: top?.candidate ?? 'No scores yet', up: true, accent: 'amber' as const },
  ];

  return (
    <EmployerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Interview Results</h1>
        <p className="text-sm text-gray-400 mt-0.5">AI interview outcomes for candidates applying to your roles</p>
      </div>

      {isLoading && <LoadingState msg="Loading interviews…" />}
      {isError && <Alert v="error">Could not load interviews. Is the backend running and your company set up?</Alert>}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{metrics.map((m) => <MetricCard key={m.label} {...m} />)}</div>
          <div className="flex gap-2 mb-5">
            {([['all', 'All'], ['completed', 'Completed'], ['upcoming', 'Upcoming']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${tab === k ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-navy hover:text-navy'}`}>{l}</button>
            ))}
          </div>

          <div className="flex flex-col gap-5">
            {filtered.map((iv) => {
              const s = STATUS[iv.status] ?? STATUS.abandoned;
              const when = iv.completed_at ?? iv.scheduled_at;
              return (
                <Card key={iv.id}>
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-navy-lt flex items-center justify-center font-display font-extrabold text-navy text-sm flex-shrink-0">{initials(iv.candidate)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-display font-bold text-navy">{iv.candidate}</span>
                        <Badge v={s.badge}>{s.label}</Badge>
                      </div>
                      <div className="text-sm text-gray-500 mb-1">{iv.job_title}</div>
                      {when && <div className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={11} />{dateTime(when)}</div>}
                    </div>
                    {iv.overall_score != null && (
                      <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border-2 flex-shrink-0 ${iv.overall_score >= 90 ? 'border-green bg-green-xlt text-green' : iv.overall_score >= 80 ? 'border-blue bg-blue-lt text-blue' : 'border-amber bg-amber-lt text-amber'}`}>
                        <span className="text-lg font-display font-extrabold leading-none">{Math.round(iv.overall_score)}</span>
                        <span className="text-[10px]">/100</span>
                      </div>
                    )}
                  </div>
                  {iv.status === 'completed' && (
                    <div className="mt-3 flex items-center gap-3">
                      <Btn v="outline" sz="sm" onClick={() => setOpen(iv)}>View answers & scores</Btn>
                      {iv.overall_score == null && <span className="text-xs text-gray-400">Awaiting AI scoring</span>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          {filtered.length === 0 && <EmptyState icon={<Video size={36} />} title="No interviews in this view" />}
        </>
      )}
      {open && <ReportModal iv={open} onClose={() => setOpen(null)} />}
    </EmployerShell>
  );
}
