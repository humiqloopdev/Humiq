// src/components/ui/employer/pipeline-page.tsx
import { useState } from 'react';
import { Clock, FileCheck, MessageSquare, Star, Trophy, UserX, Video } from 'lucide-react';
import { Alert, Btn, Input, LoadingState, MetricCard, Modal, Textarea } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import {
  useAddNote, useApplicationDetail, useEmployerAnalytics, useEmployerDashboard, useEmployerJobs, useInviteInterview,
  useMoveApplication, usePipeline, useSendOffer, type PipelineApp,
} from '@/api/employer/useEmployerQueries';
import { apiErrorMessage, timeAgo } from '@/lib/utils';

const STAGES = ['applied', 'in_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offer_received', 'accepted', 'rejected'] as const;

const STAGE_META: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  applied: { color: 'text-gray-500', bg: 'bg-gray-100', icon: <FileCheck size={14} /> },
  in_review: { color: 'text-blue', bg: 'bg-blue-lt', icon: <MessageSquare size={14} /> },
  shortlisted: { color: 'text-amber', bg: 'bg-amber-lt', icon: <Star size={14} /> },
  interview_scheduled: { color: 'text-purple', bg: 'bg-purple-lt', icon: <Video size={14} /> },
  interviewed: { color: 'text-purple', bg: 'bg-purple-lt', icon: <Video size={14} /> },
  offer_received: { color: 'text-green', bg: 'bg-green-xlt', icon: <FileCheck size={14} /> },
  accepted: { color: 'text-green-dk', bg: 'bg-green-lt', icon: <Trophy size={14} /> },
  rejected: { color: 'text-red', bg: 'bg-red-lt', icon: <UserX size={14} /> },
};

// Mirrors the moves the backend allows. The backend is the real gatekeeper.
const MOVES: Record<string, string[]> = {
  applied: ['in_review', 'shortlisted', 'rejected'],
  in_review: ['shortlisted', 'rejected'],
  shortlisted: ['in_review', 'interview_scheduled', 'interviewed', 'rejected'],
  interview_scheduled: ['interviewed', 'shortlisted', 'rejected'],
  interviewed: ['shortlisted', 'rejected'],
  offer_received: ['rejected'],
};
const LABEL: Record<string, string> = {
  applied: 'Applied', in_review: 'Screened', shortlisted: 'Shortlisted', interview_scheduled: 'Interview Scheduled',
  interviewed: 'Interviewed', offer_received: 'Offer Sent', accepted: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn',
};
const OFFERABLE = ['shortlisted', 'interview_scheduled', 'interviewed'];
const INVITABLE = ['applied', 'in_review', 'shortlisted', 'interview_scheduled', 'interviewed'];

const ring = (s: number | null) =>
  s == null ? 'text-gray-400 border-gray-200 bg-gray-50' : s >= 90 ? 'text-green border-green bg-green-xlt' : s >= 80 ? 'text-blue border-blue bg-blue-lt' : 'text-amber border-amber-lt bg-amber-lt';

function ApplicationModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: app, isLoading } = useApplicationDetail(id);
  const move = useMoveApplication();
  const addNote = useAddNote();
  const invite = useInviteInterview();
  const offer = useSendOffer();
  const [note, setNote] = useState('');
  const [rate, setRate] = useState('');
  const [start, setStart] = useState('');
  const [showOffer, setShowOffer] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = (p: Promise<unknown>, done?: string) =>
    p.then(() => { setError(''); if (done) setInfo(done); }).catch((e) => { setInfo(''); setError(apiErrorMessage(e)); });

  return (
    <Modal open onClose={onClose} title={app ? app.candidate.name : 'Application'}>
      {isLoading || !app ? <LoadingState /> : (
        <div className="flex flex-col gap-4 text-sm">
          {error && <Alert v="error">{error}</Alert>}
          {info && <Alert v="success">{info}</Alert>}
          <div className="text-gray-500">
            {app.job.title} · <b className="text-navy">{LABEL[app.status]}</b> · applied {timeAgo(app.appliedAt)}
            {app.candidate.aiScore != null && <> · AI score <b className="text-green">{app.candidate.aiScore}</b></>}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {(MOVES[app.status] ?? []).length > 0 && (
              <select
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm"
                value=""
                disabled={move.isPending}
                onChange={(e) => e.target.value && run(move.mutateAsync({ id, status: e.target.value }), `Moved to ${LABEL[e.target.value]}.`)}
              >
                <option value="">Move to…</option>
                {MOVES[app.status].map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
              </select>
            )}
            {INVITABLE.includes(app.status) && (
              <Btn v="outline" sz="sm" icon={<Video size={13} />} loading={invite.isPending}
                onClick={() => run(invite.mutateAsync({ applicationId: id }), 'Interview invitation sent.')}>Invite to interview</Btn>
            )}
            {OFFERABLE.includes(app.status) && <Btn v="primary" sz="sm" onClick={() => setShowOffer((v) => !v)}>Send offer</Btn>}
          </div>

          {showOffer && (
            <div className="border border-gray-200 rounded-xl p-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Rate ($/hr)" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
                <Input label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <Btn v="navy" sz="sm" loading={offer.isPending} disabled={!rate || !start}
                onClick={() => run(offer.mutateAsync({ application_id: id, rate: Number(rate), start_date: start }).then(() => setShowOffer(false)), 'Offer sent.')}>
                Send offer
              </Btn>
            </div>
          )}

          <div>
            <h4 className="font-bold text-navy mb-2">History</h4>
            {app.history.map((h, i) => (
              <div key={i} className="text-xs text-gray-600 py-0.5">
                {LABEL[h.to_status] ?? h.to_status} · {timeAgo(h.changed_at)}{h.note ? ` — ${h.note}` : ''}
              </div>
            ))}
          </div>

          <div>
            <h4 className="font-bold text-navy mb-2">Notes</h4>
            {app.notes.length === 0 && <p className="text-xs text-gray-400 mb-2">No notes yet.</p>}
            {app.notes.map((n) => (
              <div key={n.id} className="bg-gray-50 rounded-lg px-3 py-2 mb-2 text-xs text-gray-600">
                {n.note} {n.rating ? <b className="text-amber">{'★'.repeat(n.rating)}</b> : null}
                <div className="text-gray-400 mt-0.5">{n.author ?? 'Someone'} · {timeAgo(n.created_at)}</div>
              </div>
            ))}
            <Textarea rows={2} placeholder="Add a note for your team…" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="mt-2">
              <Btn v="outline" sz="sm" loading={addNote.isPending} disabled={!note.trim()}
                onClick={() => run(addNote.mutateAsync({ id, note: note.trim() }).then(() => setNote('')))}>Add note</Btn>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function PipelinePage() {
  const [jobId, setJobId] = useState<string | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: jobs = [] } = useEmployerJobs();
  const { data: pipeline, isLoading, isError } = usePipeline(jobId);
  const { data: dash } = useEmployerDashboard();
  const { data: analytics } = useEmployerAnalytics();

  const byStage = (status: string) => pipeline?.stages.find((s) => s.status === status)?.applications ?? [];

  const metrics = [
    { icon: <FileCheck size={20} />, value: String(dash?.activePipeline ?? '—'), label: 'Active Pipeline', delta: `${dash?.totalApplicants ?? 0} total applicants`, up: true, accent: 'navy' as const },
    { icon: <Video size={20} />, value: String(dash?.interviewsThisWeek ?? '—'), label: 'Interviews This Week', delta: 'All roles', up: true, accent: 'blue' as const },
    { icon: <Trophy size={20} />, value: String(dash?.offersExtended ?? '—'), label: 'Offers Extended', delta: 'Awaiting response', up: true, accent: 'green' as const },
    { icon: <Clock size={20} />, value: analytics?.avgDaysToHire != null ? `${analytics.avgDaysToHire}d` : '—', label: 'Avg. Time to Hire', delta: 'Applied to hired', up: true, accent: 'amber' as const },
  ];

  return (
    <EmployerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Hiring Pipeline</h1>
        <p className="text-sm text-gray-400 mt-0.5">Click a candidate to move them, add notes, invite or send an offer</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
        {[{ id: undefined, title: 'All Roles' }, ...jobs.filter((j) => j.status !== 'draft').map((j) => ({ id: j.id as string | undefined, title: j.title }))].map((j) => (
          <button
            key={j.id ?? 'all'}
            onClick={() => setJobId(j.id)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap border transition-all cursor-pointer flex-shrink-0 ${
              jobId === j.id ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-navy hover:text-navy'
            }`}
          >
            {j.title}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState msg="Loading pipeline…" />}
      {isError && <Alert v="error">Could not load the pipeline. Is the backend running and your company set up?</Alert>}

      {pipeline && (
        <div className="overflow-x-auto overflow-y-hidden -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-3 border border-gray-100 rounded-2xl bg-gray-50/50">
          <div className="flex gap-4 min-w-max p-4">
            {STAGES.map((stage) => {
              const list: PipelineApp[] = byStage(stage);
              const meta = STAGE_META[stage];
              return (
                <div key={stage} className="w-64 flex-shrink-0 flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={meta.color}>{meta.icon}</span>
                      <span className="text-sm font-bold text-navy">{LABEL[stage]}</span>
                    </div>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${meta.bg} ${meta.color}`}>{list.length}</span>
                  </div>
                  <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-0.5">
                    {list.map((c) => (
                      <div key={c.id} onClick={() => setOpenId(c.id)} className="bg-white rounded-2xl p-4 shadow-card cursor-pointer hover:shadow-hover transition-shadow flex-shrink-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center flex-shrink-0 ${ring(c.candidate.aiScore)}`}>
                            <span className="text-xs font-extrabold leading-none">{c.candidate.aiScore ?? '—'}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-navy text-sm truncate">{c.candidate.name}</div>
                            <div className="text-xs text-gray-400 truncate">{c.job.title}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>{timeAgo(c.appliedAt)}</span>
                          {c.matchScore != null && <span>{c.matchScore}% match</span>}
                        </div>
                      </div>
                    ))}
                    {list.length === 0 && (
                      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center text-xs text-gray-400">No candidates</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openId && <ApplicationModal id={openId} onClose={() => setOpenId(null)} />}
    </EmployerShell>
  );
}
