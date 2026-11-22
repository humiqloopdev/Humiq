// src/components/ui/candidate/job-discovery-page.tsx
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Alert, Btn, Card, EmptyState, LoadingState, SearchBar, Tag } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import {
  apiErrorMessage, useApplyToJob, useJobSearch, useSaveJob, useUnsaveJob,
} from '@/api/candidate/useCandidateQueries';
import { formatRate, timeAgo } from '@/lib/utils';

const COMMITMENTS = ['All', 'Full-time', 'Part-time', 'Contract'] as const;

export function JobDiscoveryPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [commitment, setCommitment] = useState<(typeof COMMITMENTS)[number]>('All');
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useJobSearch({
    q: search || undefined,
    commitment: commitment === 'All' ? undefined : commitment,
  });
  const apply = useApplyToJob();
  const save = useSaveJob();
  const unsave = useUnsaveJob();
  const jobs = data?.results ?? [];

  const run = (p: Promise<unknown>) => p.then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));

  const scoreColor = (s: number) =>
    s >= 90 ? 'text-green border-green bg-green-xlt' : s >= 80 ? 'text-blue border-blue bg-blue-lt' : s >= 70 ? 'text-amber border-amber bg-amber-lt' : 'text-gray-400 border-gray-200 bg-gray-50';

  return (
    <CandidateShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Job Discovery</h1>
        <p className="text-sm text-gray-400 mt-0.5">AI-matched roles</p>
      </div>
      <SearchBar placeholder="Search roles, companies, skills…" value={query} onChange={setQuery} onSearch={() => setSearch(query.trim())} />
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        <div className="w-full lg:w-52 flex-shrink-0 lg:sticky lg:top-24 h-fit">
          <Card flat>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Commitment</h4>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {COMMITMENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCommitment(c)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold border text-left cursor-pointer transition-all ${
                    commitment === c ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-navy'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Card>
        </div>
        <div className="flex-1 min-w-0">
          {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
          {isLoading && <LoadingState msg="Finding matches…" />}
          {isError && <Alert v="error">Could not load jobs. Is the backend running?</Alert>}
          {!isLoading && !isError && (
            <p className="font-bold text-navy mb-4 text-sm">
              {jobs.length} matched {jobs.length === 1 ? 'role' : 'roles'} <span className="text-gray-400 font-normal">· Sorted by best match</span>
            </p>
          )}
          {!isLoading && !isError && jobs.length === 0 && <EmptyState title="No jobs found" body="Try a different search or filter." />}
          <div className="flex flex-col gap-4">
            {jobs.map((j) => (
              <Card key={j.id} hover>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
                  <div className={`w-16 h-16 rounded-2xl border-[3px] flex flex-col items-center justify-center flex-shrink-0 ${scoreColor(j.match_score)}`}>
                    <span className="text-xl font-display font-extrabold leading-none">{j.match_score}%</span>
                    <span className="text-[10px] text-gray-400">match</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-navy">{j.title}</div>
                    <div className="text-sm text-gray-500">
                      {j.company_name} · {j.location ?? 'Remote'} · {j.commitment} · {formatRate(j.rate_from, j.rate_to)}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">{j.skills.map((s) => <Tag key={s}>{s}</Tag>)}</div>
                    <div className="text-xs text-gray-400 mt-2">Posted {timeAgo(j.posted_at)} · {j.applicants} applicants</div>
                  </div>
                  <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
                    <Btn
                      v="ghost" sz="sm" icon={<Heart size={13} fill={j.is_saved ? 'currentColor' : 'none'} />}
                      onClick={() => run((j.is_saved ? unsave : save).mutateAsync(j.id))}
                    >
                      {j.is_saved ? 'Saved' : 'Save'}
                    </Btn>
                    {j.application_status ? (
                      <Btn v="outline" sz="sm" disabled>Applied ✓</Btn>
                    ) : (
                      <Btn v="primary" sz="sm" loading={apply.isPending && apply.variables === j.id} onClick={() => run(apply.mutateAsync(j.id))}>
                        Apply →
                      </Btn>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </CandidateShell>
  );
}
