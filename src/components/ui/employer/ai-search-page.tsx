// src/components/ui/employer/ai-search-page.tsx
import { useState } from 'react';
import { Bot, Sparkles, Search as SearchIcon } from 'lucide-react';
import { Alert, Btn, Card, EmptyState } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { useAiSearch } from '@/api/employer/useEmployerQueries';
import { apiErrorMessage } from '@/lib/utils';
import { CandidateCard } from './candidate-card';

const SUGGESTIONS = [
  'Senior React engineer with TypeScript',
  'Python PyTorch machine learning engineer',
  'Node.js PostgreSQL backend developer',
  'DevOps AWS Kubernetes Docker',
];

export function AiSearchPage() {
  const [query, setQuery] = useState('');
  const search = useAiSearch();

  const run = (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setQuery(term);
    search.mutate(term);
  };

  return (
    <EmployerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy flex items-center gap-2">
          <Bot size={22} className="text-blue" /> Talent Search
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Type the skills and role you need. Candidates are ranked by how many of your terms they match.
        </p>
      </div>

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/20 transition-all">
            <input
              className="flex-1 px-4 py-3 text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
              placeholder="e.g. senior react node.js aws"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <Btn v="navy" sz="lg" icon={<SearchIcon size={15} />} loading={search.isPending} onClick={() => run()}>Search</Btn>
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Try one of these</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => run(s)} className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-blue hover:text-blue transition-colors cursor-pointer">{s}</button>
            ))}
          </div>
        </div>
      </Card>

      {search.isError && <Alert v="error">{apiErrorMessage(search.error, 'Search failed')}</Alert>}

      {!search.data && !search.isPending && !search.isError && (
        <EmptyState icon={<Sparkles size={36} />} title="Describe the skills you need" body="Try a suggestion above or write your own search." />
      )}

      {search.data && (
        <>
          <p className="font-bold text-navy mb-4 text-sm">
            {search.data.results.length} matches for <span className="text-blue">{search.data.terms.join(', ')}</span>
          </p>
          {search.data.results.length === 0 && <EmptyState title="No matching candidates" body="Try different or fewer terms." />}
          <div className="flex flex-col gap-4">
            {search.data.results.map((c) => <CandidateCard key={c.id} c={c} showMatch />)}
          </div>
        </>
      )}
    </EmployerShell>
  );
}
