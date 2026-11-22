// src/components/ui/candidate/saved-jobs-page.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Heart, MapPin, Clock, DollarSign, Trash2 } from 'lucide-react';
import { Alert, Badge, Btn, Card, LoadingState, Tag } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import { apiErrorMessage, useApplyToJob, useSavedJobs, useUnsaveJob } from '@/api/candidate/useCandidateQueries';
import { formatRate } from '@/lib/utils';

const SCORE_COLOR = (s: number) =>
  s >= 90 ? 'text-green border-green bg-green-xlt'
  : s >= 80 ? 'text-blue border-blue bg-blue-lt'
  : s >= 70 ? 'text-amber border-amber bg-amber-lt'
  : 'text-gray-400 border-gray-200 bg-gray-50';

export function SavedJobsPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { data: jobs = [], isLoading, isError } = useSavedJobs();
  const unsave = useUnsaveJob();
  const apply = useApplyToJob();

  const run = (p: Promise<unknown>) => p.then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));

  return (
    <CandidateShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy">Saved Jobs</h1>
          <p className="text-sm text-gray-400 mt-0.5">{jobs.length} saved</p>
        </div>
        <Btn v="outline" sz="sm" onClick={() => navigate({ to: '/candidate/jobs' })} className="self-start">Browse More Jobs</Btn>
      </div>

      {isLoading && <LoadingState msg="Loading saved jobs…" />}
      {isError && <Alert v="error">Could not load saved jobs. Is the backend running?</Alert>}
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}

      <div className="flex flex-col gap-4">
        {jobs.map((job) => (
          <Card key={job.id}>
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl border-[3px] flex flex-col items-center justify-center flex-shrink-0 ${SCORE_COLOR(job.match_score)}`}>
                <span className="text-lg font-display font-extrabold leading-none">{job.match_score}%</span>
                <span className="text-[10px] text-gray-400">match</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-display font-bold text-navy">{job.title}</span>
                  {job.application_status && <Badge v="blue">Applied ✓</Badge>}
                </div>
                <div className="font-semibold text-gray-600 text-sm mb-1">{job.company_name}</div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                  <span className="flex items-center gap-1"><MapPin size={11} />{job.location ?? 'Remote'}</span>
                  <span className="flex items-center gap-1"><DollarSign size={11} />{formatRate(job.rate_from, job.rate_to)}</span>
                  <span className="flex items-center gap-1"><Clock size={11} />{job.commitment}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">{job.skills.map((s) => <Tag key={s}>{s}</Tag>)}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-100">
              <div className="flex gap-2">
                {!job.application_status && (
                  <Btn v="primary" sz="sm" loading={apply.isPending && apply.variables === job.id} onClick={() => run(apply.mutateAsync(job.id))}>
                    Apply →
                  </Btn>
                )}
              </div>
              <button
                onClick={() => run(unsave.mutateAsync(job.id))}
                className="p-1.5 rounded-lg text-red hover:bg-red-lt transition-colors cursor-pointer"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {!isLoading && !isError && jobs.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Heart size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No saved jobs yet</p>
          <p className="text-sm mt-1">Browse roles and hit Save to build your list.</p>
          <Btn v="primary" sz="sm" className="mt-4" onClick={() => navigate({ to: '/candidate/jobs' })}>Browse Jobs</Btn>
        </div>
      )}
    </CandidateShell>
  );
}
