// src/components/ui/candidate/candidate-dashboard.tsx
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2, ClipboardList, Heart, Star, Video } from 'lucide-react';
import { Alert, Btn, Card, LoadingState, MetricCard, ProgressBar } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import {
  useApplications, useCandidateDashboard, useInterviewHistory, useInterviewResults, useRecommendedJobs,
} from '@/api/candidate/useCandidateQueries';
import { formatRate, timeAgo } from '@/lib/utils';
import type { PipelineStep, ScoreItem } from '@/types';

const CATEGORY_LABEL: Record<string, string> = {
  technical_depth: 'Technical Depth', communication: 'Communication',
  system_design: 'System Design', problem_solving: 'Problem Solving',
};

// Order of the hiring pipeline; the furthest-along application drives the checklist.
const STAGES = ['applied', 'in_review', 'shortlisted', 'interview_scheduled', 'offer_received', 'accepted'];

export function CandidateDashboard() {
  const navigate = useNavigate();
  const { data: dash, isLoading, isError } = useCandidateDashboard();
  const { data: apps = [] } = useApplications();
  const { data: interviews = [] } = useInterviewHistory();
  const { data: recommended = [] } = useRecommendedJobs();

  const lastScored = interviews.find((i) => i.status === 'completed' && i.overall_score != null);
  const { data: results } = useInterviewResults(lastScored?.id);

  if (isLoading) return <CandidateShell><LoadingState msg="Loading your dashboard…" /></CandidateShell>;
  if (isError || !dash) {
    return <CandidateShell><Alert v="error">Could not load the dashboard. Is the backend running?</Alert></CandidateShell>;
  }

  const metrics = [
    { icon: <ClipboardList size={20} />, value: String(dash.activeApplications), label: 'Active Applications', delta: `${dash.offers} offer${dash.offers === 1 ? '' : 's'}`, up: true, accent: 'blue' as const },
    { icon: <Video size={20} />, value: String(dash.interviewsScheduled + dash.interviewsPending), label: 'Interviews Pending', delta: `${dash.interviewsScheduled} scheduled`, up: true, accent: 'purple' as const },
    { icon: <Star size={20} />, value: `${dash.profileScore}%`, label: 'Profile Score', delta: dash.profileScore < 100 ? 'Complete steps' : 'Complete', up: true, accent: 'amber' as const },
    { icon: <Heart size={20} />, value: String(dash.savedJobs), label: 'Saved Jobs', delta: 'View list', up: true, accent: 'green' as const },
  ];

  const open = apps.filter((a) => !['rejected', 'withdrawn'].includes(a.status));
  const lead = [...open].sort((a, b) => STAGES.indexOf(b.status) - STAGES.indexOf(a.status))[0];
  const reached = lead ? STAGES.indexOf(lead.status) : -1;

  const pipeline: PipelineStep[] = [
    { done: dash.profileScore >= 80, label: 'Profile Complete', sub: `${dash.profileScore}% complete` },
    {
      done: !!lastScored, label: 'AI Interview Done',
      sub: lastScored ? `Score: ${lastScored.overall_score}/100 · ${timeAgo(lastScored.completed_at!)}` : 'Not taken yet',
    },
    {
      done: reached >= STAGES.indexOf('shortlisted'), active: reached >= 0 && reached < STAGES.indexOf('shortlisted'),
      label: lead ? `Under Review — ${lead.company_name}` : 'Apply to a job',
      sub: lead ? lead.title : 'No active applications',
    },
    {
      done: reached >= STAGES.indexOf('interview_scheduled') && reached > STAGES.indexOf('interview_scheduled'),
      active: reached === STAGES.indexOf('interview_scheduled') || reached === STAGES.indexOf('shortlisted'),
      label: 'Technical Screen', sub: reached >= STAGES.indexOf('interview_scheduled') ? 'Interview scheduled' : 'Awaiting invite',
    },
    { done: reached >= STAGES.indexOf('accepted'), active: reached === STAGES.indexOf('offer_received'), label: 'Offer & Contract', sub: reached >= STAGES.indexOf('offer_received') ? 'Offer received' : '—' },
  ];

  const scores: ScoreItem[] = (results?.scores ?? []).map((s) => ({ label: CATEGORY_LABEL[s.category] ?? s.category, value: s.score }));

  return (
    <CandidateShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your hiring overview</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-display font-bold text-navy mb-5">Application Pipeline</h3>
          <div className="flex flex-col gap-4">
            {pipeline.map((s, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${s.done ? 'bg-green text-white' : s.active ? 'bg-green-lt text-green-dk' : 'bg-gray-100 text-gray-400'}`}>
                  {s.done ? <CheckCircle2 size={15} /> : i + 1}
                </div>
                <div className={`flex-1 rounded-xl ${s.active ? 'bg-green-xlt px-3 py-2' : 'py-1'}`}>
                  <div className={`font-semibold text-sm ${s.done || s.active ? 'text-navy' : 'text-gray-400'}`}>{s.label}</div>
                  <div className="text-xs text-gray-400">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <h3 className="font-display font-bold text-navy mb-1">Interview Score</h3>
            {dash.avgAiScore == null ? (
              <p className="text-sm text-gray-400">No scored interviews yet.</p>
            ) : (
              <>
                <p className="text-sm font-bold text-green mb-5">{dash.avgAiScore}/100 average</p>
                <div className="flex flex-col gap-4">{scores.map((s) => <ProgressBar key={s.label} label={s.label} value={s.value} max={100} />)}</div>
              </>
            )}
          </Card>
          <Card>
            <h3 className="font-display font-bold text-navy mb-4">Recommended For You</h3>
            {recommended.length === 0 && <p className="text-sm text-gray-400">No new recommendations.</p>}
            {recommended.slice(0, 3).map((r) => (
              <div key={r.id} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
                <div>
                  <div className="font-semibold text-navy text-sm">{r.title} — {r.company_name}</div>
                  <div className="text-xs text-gray-400">{r.match_score}% match · {formatRate(r.rate_from, r.rate_to)}</div>
                </div>
                <Btn v="primary" sz="sm" onClick={() => navigate({ to: '/candidate/jobs' })}>Apply →</Btn>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </CandidateShell>
  );
}
