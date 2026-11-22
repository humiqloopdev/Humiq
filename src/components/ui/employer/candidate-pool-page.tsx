// src/components/ui/employer/candidate-pool-page.tsx
import { useState } from 'react';
import { Alert, Card, EmptyState, LoadingState, SearchBar } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { useCandidatePool } from '@/api/employer/useEmployerQueries';
import { CandidateCard } from './candidate-card';

export function CandidatePoolPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [skills, setSkills] = useState('');
  const [minScore, setMinScore] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);

  const { data, isLoading, isError } = useCandidatePool({
    q: search || undefined,
    skills: skills.trim() || undefined,
    minScore: minScore || undefined,
    savedOnly: savedOnly ? 'true' : undefined,
  });
  const candidates = data?.results ?? [];

  return (
    <EmployerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Candidate Pool</h1>
        <p className="text-sm text-gray-400 mt-0.5">Browse candidates, ranked by AI interview score</p>
      </div>
      <SearchBar placeholder="Search by name, role or headline…" value={query} onChange={setQuery} onSearch={() => setSearch(query.trim())} />
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        <div className="w-full lg:w-56 flex-shrink-0 lg:sticky lg:top-24 h-fit">
          <Card flat>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Filters</h4>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Must have skills (comma separated)</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm mb-4" placeholder="react, node.js" value={skills} onChange={(e) => setSkills(e.target.value)} />
            <label className="text-xs font-semibold text-gray-500 block mb-1">Min AI score</label>
            <input type="number" min={0} max={100} className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm mb-4" placeholder="e.g. 80" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} /> Saved only
            </label>
          </Card>
        </div>
        <div className="flex-1 min-w-0">
          {isLoading && <LoadingState msg="Loading candidates…" />}
          {isError && <Alert v="error">Could not load candidates. Is the backend running and your company set up?</Alert>}
          {!isLoading && !isError && (
            <p className="font-bold text-navy mb-4 text-sm">{candidates.length} candidates <span className="text-gray-400 font-normal">· Ranked by AI score</span></p>
          )}
          {!isLoading && !isError && candidates.length === 0 && <EmptyState title="No candidates match" body="Try fewer filters." />}
          <div className="flex flex-col gap-4">{candidates.map((c) => <CandidateCard key={c.id} c={c} />)}</div>
        </div>
      </div>
    </EmployerShell>
  );
}
