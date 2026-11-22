// src/components/ui/employer/candidate-card.tsx
// One candidate row, shared by the Candidate Pool and Talent Search pages.
import { useState } from 'react';
import { Bookmark, MapPin, Sparkles } from 'lucide-react';
import { Alert, Badge, Btn, Card, Modal, Tag } from '@/components/ui/common';
import {
  useEmployerJobs, useShortlistCandidate, useToggleSaveCandidate, type PoolCandidate,
} from '@/api/employer/useEmployerQueries';
import { apiErrorMessage, initials } from '@/lib/utils';

const ring = (s: number | null) =>
  s == null ? 'text-gray-400 border-gray-200 bg-gray-50' : s >= 90 ? 'text-green border-green bg-green-xlt' : s >= 80 ? 'text-blue border-blue bg-blue-lt' : 'text-amber border-amber bg-amber-lt';

export function CandidateCard({ c, showMatch }: { c: PoolCandidate; showMatch?: boolean }) {
  const [picking, setPicking] = useState(false);
  const [jobId, setJobId] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const { data: jobs = [] } = useEmployerJobs();
  const shortlist = useShortlistCandidate();
  const toggleSave = useToggleSaveCandidate();
  const openJobs = jobs.filter((j) => j.status === 'active' || j.status === 'paused');

  const doShortlist = () =>
    shortlist.mutateAsync({ candidateId: c.id, jobId })
      .then(() => { setDone(`Shortlisted for ${openJobs.find((j) => j.id === jobId)?.title}.`); setPicking(false); setError(''); })
      .catch((e) => setError(apiErrorMessage(e)));

  const score = showMatch ? (c.matchScore ?? null) : c.aiScore;

  return (
    <Card hover>
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className={`w-16 h-16 rounded-2xl border-[3px] flex flex-col items-center justify-center flex-shrink-0 ${ring(score)}`}>
          <span className="text-lg font-display font-extrabold leading-none">{score ?? '—'}{score != null && '%'}</span>
          <span className="text-[10px] text-gray-400">{showMatch ? 'match' : 'AI score'}</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-navy-lt flex items-center justify-center font-display font-extrabold text-navy text-sm flex-shrink-0">{initials(c.name)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-navy">{c.name}</span>
            {c.availability && <Badge v="green">{c.availability}</Badge>}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-0.5 mb-2">
            <span>{c.role ?? 'Role not set'}{c.yearsExperience != null ? ` · ${c.yearsExperience} yrs` : ''}</span>
            {c.location && <span className="flex items-center gap-1"><MapPin size={11} />{c.location}</span>}
            {c.rate && <span>${c.rate.min}{c.rate.preferred ? `–${c.rate.preferred}` : ''}/hr</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">{c.skills.map((s) => <Tag key={s}>{s}</Tag>)}</div>
          {showMatch && c.matchedSkills && c.matchedSkills.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-blue bg-blue-lt px-2.5 py-1.5 rounded-lg mt-2 w-fit">
              <Sparkles size={12} className="flex-shrink-0 mt-0.5" />
              <span>Matched on: {c.matchedSkills.join(', ')}</span>
            </div>
          )}
        </div>
        <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
          <Btn v="ghost" sz="sm" icon={<Bookmark size={13} fill={c.isSaved ? 'currentColor' : 'none'} />}
            loading={toggleSave.isPending && toggleSave.variables?.id === c.id}
            onClick={() => toggleSave.mutateAsync({ id: c.id, saved: c.isSaved }).catch((e) => setError(apiErrorMessage(e)))}>
            {c.isSaved ? 'Saved' : 'Save'}
          </Btn>
          <Btn v="primary" sz="sm" onClick={() => { setPicking(true); setDone(''); }}>Shortlist →</Btn>
        </div>
      </div>
      {done && <div className="mt-3"><Alert v="success">{done}</Alert></div>}
      {error && !picking && <div className="mt-3"><Alert v="error">{error}</Alert></div>}

      {picking && (
        <Modal open onClose={() => { setPicking(false); setError(''); }} title={`Shortlist ${c.name}`}
          footer={<><Btn v="ghost" onClick={() => setPicking(false)}>Cancel</Btn><Btn v="primary" disabled={!jobId} loading={shortlist.isPending} onClick={doShortlist}>Shortlist</Btn></>}>
          {error && <div className="mb-3"><Alert v="error">{error}</Alert></div>}
          {openJobs.length === 0 ? (
            <p className="text-sm text-gray-500">You have no active roles. Publish a job first.</p>
          ) : (
            <>
              <label className="text-sm font-semibold text-gray-700 block mb-2">For which role?</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">Choose a role…</option>
                {openJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </>
          )}
        </Modal>
      )}
    </Card>
  );
}
