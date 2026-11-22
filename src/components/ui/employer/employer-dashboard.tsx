// src/components/ui/employer/employer-dashboard.tsx
import { useNavigate } from '@tanstack/react-router';
import { Bell, Bot, Briefcase, CheckCircle2, Star, Users } from 'lucide-react';
import { Alert, Badge, Btn, Card, DataTable, EmptyState, LoadingState, MetricCard, SearchBar } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { useEmployerDashboard, useEmployerJobs } from '@/api/employer/useEmployerQueries';
import { apiErrorMessage, timeAgo } from '@/lib/utils';
import { useState } from 'react';

const STAGE_TEXT: Record<string, string> = {
  applied: 'applied', in_review: 'was screened', shortlisted: 'was shortlisted', interview_scheduled: 'has an interview scheduled',
  interviewed: 'completed an interview', offer_received: 'received an offer', accepted: 'accepted an offer', rejected: 'was rejected', withdrawn: 'withdrew',
};
const DOT: Record<string, string> = { applied: '🔵', shortlisted: '🟡', accepted: '🟢', rejected: '🔴', offer_received: '🟣' };

export function EmployerDashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useEmployerDashboard();
  const { data: jobs = [] } = useEmployerJobs();

  if (isLoading) return <EmployerShell><LoadingState msg="Loading your dashboard…" /></EmployerShell>;
  if (error || !data) {
    const needsSetup = (error as { response?: { status?: number } })?.response?.status === 409;
    return (
      <EmployerShell>
        <Alert v={needsSetup ? 'warning' : 'error'}>{needsSetup ? 'Set up your company profile to get started.' : apiErrorMessage(error, 'Could not load the dashboard. Is the backend running?')}</Alert>
        {needsSetup && <div className="mt-4"><Btn v="primary" onClick={() => navigate({ to: '/employer/onboarding/company' })}>Set up company →</Btn></div>}
      </EmployerShell>
    );
  }

  const metrics = [
    { icon: <Briefcase size={20} />, value: String(data.openRoles), label: 'Open Roles', delta: `${jobs.length} total roles`, up: true, accent: 'navy' as const },
    { icon: <Users size={20} />, value: String(data.totalApplicants), label: 'Total Applicants', delta: 'All roles', up: true, accent: 'blue' as const },
    { icon: <Star size={20} />, value: String(data.activePipeline), label: 'Active Pipeline', delta: 'In progress', up: true, accent: 'amber' as const },
    { icon: <CheckCircle2 size={20} />, value: String(data.offersExtended), label: 'Offers Sent', delta: 'Awaiting response', up: true, accent: 'green' as const },
  ];
  const active = jobs.filter((j) => j.status === 'active' || j.status === 'paused').slice(0, 5);

  return (
    <EmployerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Employer Overview</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your hiring command center</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display font-bold text-navy">Active Job Postings</h3>
          <Btn v="outline" sz="sm" onClick={() => navigate({ to: '/employer/jobs' })}>View All</Btn>
        </div>
        {active.length === 0 ? (
          <EmptyState icon={<Briefcase size={36} />} title="No active roles" body="Active roles will appear here." />
        ) : (
          <DataTable
            cols={[
              { key: 'title', label: 'ROLE', render: (v, r: (typeof active)[number]) => <div><div className="font-bold text-navy">{v}</div><div className="text-xs text-gray-400">${r.rate_from}–{r.rate_to}/hr · {r.commitment}</div></div> },
              { key: 'applicants', label: 'APPLICANTS', style: { textAlign: 'center' }, render: (v) => <b>{v}</b> },
              { key: 'shortlisted', label: 'SHORTLISTED', style: { textAlign: 'center' }, render: (v) => <Badge v="green">{v}</Badge> },
              { key: 'status', label: 'STATUS', style: { textAlign: 'center' }, render: (v: string) => <Badge v={v === 'active' ? 'green' : 'amber'}>{v}</Badge> },
              { key: 'id', label: '', render: () => <Btn v="ghost" sz="sm" onClick={() => navigate({ to: '/employer/pipeline' })}>View →</Btn> },
            ]}
            rows={active}
          />
        )}
      </Card>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-display font-bold text-navy mb-2 flex items-center gap-2"><Bot size={18} className="text-blue" /> Talent Search</h3>
          <p className="text-sm text-gray-400 mb-4">Describe your ideal candidate, e.g. "senior react node.js aws"</p>
          <SearchBar placeholder="Senior React engineer, 5+ yrs TypeScript…" value={query} onChange={setQuery} onSearch={() => navigate({ to: '/employer/ai-search' })} />
        </Card>
        <Card>
          <h3 className="font-display font-bold text-navy mb-5 flex items-center gap-2"><Bell size={18} className="text-amber" /> Recent Activity</h3>
          {data.recentActivity.length === 0 && <p className="text-sm text-gray-400">No activity yet.</p>}
          {data.recentActivity.map((a, i) => (
            <div key={i} className="flex gap-3 mb-4">
              <span>{DOT[a.to_status] ?? '⚪'}</span>
              <div>
                <div className="font-semibold text-navy text-sm">{a.candidate || 'A candidate'} {STAGE_TEXT[a.to_status] ?? a.to_status}</div>
                <div className="text-xs text-gray-400">{a.title} · {timeAgo(a.changed_at)}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </EmployerShell>
  );
}
