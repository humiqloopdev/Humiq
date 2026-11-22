// src/components/ui/candidate/open-interviews-page.tsx
// Published AI interviews, ranked by how well they match the candidate's skills.
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Calendar, Clock, Layers, MessageSquare, Sparkles } from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, LoadingState } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import { useOpenInterviews, type OpenInterview } from '@/api/aiInterviews/useOpenInterviews';
import { cn } from '@/lib/utils';

export const publishedOn = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Required skills with the candidate's matching ones highlighted. */
export function SkillChips({ required, matched }: { required: string[]; matched: string[] }) {
  if (!required.length) return <span className="text-xs text-gray-400">No specific skills listed</span>;
  const have = new Set(matched.map((s) => s.toLowerCase()));
  return (
    <div className="flex flex-wrap gap-1.5">
      {required.map((s) => (
        <span key={s} className={cn('text-xs font-medium rounded-full px-2.5 py-1 border',
          have.has(s.toLowerCase()) ? 'bg-green-xlt text-green-dk border-green-lt' : 'bg-gray-50 text-gray-500 border-gray-200')}>{s}</span>
      ))}
    </div>
  );
}

export function MetaRow({ i }: { i: Pick<OpenInterview, 'durationMinutes' | 'interviewType' | 'experienceLevel' | 'publishedAt'> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
      <span className="flex items-center gap-1"><Clock size={13} />{i.durationMinutes ? `${i.durationMinutes} min` : 'No fixed duration'}</span>
      <span className="flex items-center gap-1"><MessageSquare size={13} />{i.interviewType}</span>
      {i.experienceLevel && <span className="flex items-center gap-1"><Layers size={13} />{i.experienceLevel}</span>}
      <span className="flex items-center gap-1"><Calendar size={13} />Published {publishedOn(i.publishedAt)}</span>
    </div>
  );
}

function InterviewCard({ i, onOpen }: { i: OpenInterview; onOpen: () => void }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-navy text-base leading-snug">{i.title}</h3>
          {i.companyName && <p className="text-xs text-gray-400 mt-0.5">{i.companyName}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge v="green">Open</Badge>
          {i.matchedSkills.length > 0 && <span className="text-xs font-bold text-green-dk">{i.matchPercent}% match</span>}
        </div>
      </div>
      {i.description && <p className="text-sm text-gray-600 line-clamp-2">{i.description}</p>}
      <SkillChips required={i.requiredSkills} matched={i.matchedSkills} />
      <MetaRow i={i} />
      <div className="flex items-center justify-between gap-3 pt-1">
        {i.alreadyTaken ? <span className="text-xs font-semibold text-amber">You have taken this interview</span> : <span />}
        <Btn v="primary" sz="sm" onClick={onOpen}>View Details</Btn>
      </div>
    </Card>
  );
}

export function OpenInterviewsPage() {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, isError } = useOpenInterviews(showAll);
  const navigate = useNavigate();
  const open = (id: string) => navigate({ to: '/candidate/open-interviews/$interviewId', params: { interviewId: id } });

  return (
    <CandidateShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Open Interviews</h1>
        <p className="text-sm text-gray-400 mt-0.5">Interviews from employers that match your skills. New ones appear here as soon as they are published.</p>
      </div>

      {isLoading && <LoadingState msg="Finding interviews for you…" />}
      {isError && <Alert v="error">Could not load interviews. Please try again.</Alert>}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Sparkles size={14} className="text-green" />
              {data.candidateSkills.length
                ? <span>Matched on your skills: <b className="text-navy">{data.candidateSkills.slice(0, 6).join(', ')}{data.candidateSkills.length > 6 ? '…' : ''}</b></span>
                : <span>Add skills to your profile or resume to get matched interviews.</span>}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-green" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              Show all open interviews ({data.total})
            </label>
          </div>

          {data.interviews.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={36} />}
              title={data.total ? 'No interviews match your skills yet' : 'No open interviews right now'}
              body={data.total ? 'Turn on "Show all open interviews" to see every interview that is open.' : 'New interviews will appear here automatically when employers publish them.'}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.interviews.map((i) => <InterviewCard key={i.id} i={i} onOpen={() => open(i.id)} />)}
            </div>
          )}
        </>
      )}
    </CandidateShell>
  );
}
