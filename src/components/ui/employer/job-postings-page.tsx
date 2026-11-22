// src/components/ui/employer/job-postings-page.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Briefcase, MapPin, Clock, DollarSign, Users, Eye, Pause, Play, Trash2, XCircle } from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, LoadingState, MetricCard, SearchBar } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { useEmployerAnalytics, useEmployerJobs, useJobAction } from '@/api/employer/useEmployerQueries';
import { apiErrorMessage, timeAgo } from '@/lib/utils';

const STATUS_BADGE: Record<string, 'green' | 'amber' | 'gray' | 'blue'> = { active: 'green', paused: 'amber', closed: 'gray', draft: 'blue' };
const FILTERS = ['all', 'active', 'paused', 'draft', 'closed'] as const;

export function JobPostingsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [error, setError] = useState('');
  const { data: jobs = [], isLoading, isError } = useEmployerJobs();
  const { data: analytics } = useEmployerAnalytics();
  const action = useJobAction();

  const filtered = jobs.filter((j) => j.title.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || j.status === filter));

  const run = (id: string, act: 'activate' | 'pause' | 'close' | 'delete', confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    action.mutateAsync({ id, action: act }).then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  };

  const metrics = [
    { icon: <Briefcase size={20} />, value: String(jobs.filter((j) => j.status === 'active').length), label: 'Active Roles', delta: `${jobs.length} total`, up: true, accent: 'navy' as const },
    { icon: <Users size={20} />, value: String(jobs.reduce((s, j) => s + j.applicants, 0)), label: 'Total Applicants', delta: 'All roles', up: true, accent: 'blue' as const },
    { icon: <Eye size={20} />, value: String(jobs.reduce((s, j) => s + j.views, 0)), label: 'Job Views', delta: 'All roles', up: true, accent: 'purple' as const },
    { icon: <Clock size={20} />, value: analytics?.avgDaysToShortlist != null ? `${analytics.avgDaysToShortlist}d` : '—', label: 'Avg Time to Shortlist', delta: 'From application', up: true, accent: 'green' as const },
  ];

  return (
    <EmployerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Job Postings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage all your open, paused, and draft roles</p>
      </div>

      {isLoading && <LoadingState msg="Loading job postings…" />}
      {isError && <Alert v="error">Could not load job postings. Is the backend running and your company set up?</Alert>}
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="flex-1">
              <SearchBar placeholder="Search job titles…" value={query} onChange={setQuery} onSearch={() => {}} />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border capitalize transition-all cursor-pointer ${
                    filter === f ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-navy hover:text-navy'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {filtered.map((job) => (
              <Card key={job.id} hover>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-navy-lt flex items-center justify-center flex-shrink-0">
                    <Briefcase size={22} className="text-navy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-navy text-base">{job.title}</h3>
                      <Badge v={STATUS_BADGE[job.status]}>{job.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1"><MapPin size={12} />{job.location ?? 'Remote'}</span>
                      <span className="flex items-center gap-1"><Clock size={12} />{job.commitment}</span>
                      <span className="flex items-center gap-1"><DollarSign size={12} />${job.rate_from}–${job.rate_to}/hr</span>
                      <span className="text-gray-400">Posted {timeAgo(job.posted_at)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {job.skills.map((s) => <span key={s} className="px-2 py-0.5 bg-navy-lt text-navy text-xs font-semibold rounded-full">{s}</span>)}
                    </div>
                  </div>
                  <div className="flex gap-4 sm:flex-col sm:items-end sm:gap-1 text-sm flex-shrink-0">
                    <div className="text-center sm:text-right"><div className="font-bold text-navy text-lg">{job.applicants}</div><div className="text-xs text-gray-400">Applicants</div></div>
                    <div className="text-center sm:text-right"><div className="font-bold text-green text-lg">{job.shortlisted}</div><div className="text-xs text-gray-400">Shortlisted</div></div>
                    <div className="text-center sm:text-right"><div className="font-bold text-blue text-lg">{job.views}</div><div className="text-xs text-gray-400">Views</div></div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-4 border-t border-gray-100">
                  <Btn v="primary" sz="sm" onClick={() => navigate({ to: '/employer/pipeline' })}>View Applicants →</Btn>
                  <div className="flex gap-2">
                    {job.status === 'active' && (
                      <button onClick={() => run(job.id, 'pause')} className="p-1.5 rounded-lg text-amber hover:bg-amber-lt transition-colors cursor-pointer" title="Pause"><Pause size={15} /></button>
                    )}
                    {(job.status === 'paused' || job.status === 'draft') && (
                      <button onClick={() => run(job.id, 'activate')} className="p-1.5 rounded-lg text-green hover:bg-green-xlt transition-colors cursor-pointer" title={job.status === 'draft' ? 'Publish' : 'Activate'}><Play size={15} /></button>
                    )}
                    {job.status !== 'closed' && (
                      <button onClick={() => run(job.id, 'close', `Close "${job.title}"? It will stop accepting applicants.`)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer" title="Close"><XCircle size={15} /></button>
                    )}
                    <button onClick={() => run(job.id, 'delete', `Delete "${job.title}"? This cannot be undone.`)} className="p-1.5 rounded-lg text-red hover:bg-red-lt transition-colors cursor-pointer" title="Delete"><Trash2 size={15} /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filtered.length === 0 && (
            <EmptyState icon={<Briefcase size={40} />} title="No job postings found" body="Try adjusting your filters." />
          )}
        </>
      )}
    </EmployerShell>
  );
}
