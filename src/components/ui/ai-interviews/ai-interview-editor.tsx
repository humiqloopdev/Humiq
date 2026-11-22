// src/components/ui/ai-interviews/ai-interview-editor.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, ExternalLink, Mail, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, Input, LoadingState, Modal, Tabs, Textarea } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { timeAgo } from '@/lib/utils';
import { toast } from '@/store/toastStore';
import {
  apiErrorMessage, createPreviewSession, useInviteByEmail, useAddCandidate, useAddCandidates, useAddQuestion, useAiCandidates, useAiInterview,
  useAiSessions, useDeleteCandidates, useDeleteInterviews, useDeleteQuestion, usePublishInterview, useReorderQuestions,
  useUnpublishInterview, useUpdateInterview, useUpdateQuestion, type AiInterview, type AiQuestion, type QuestionType,
} from '@/api/aiInterviews/useAiInterviews';
import { copyText, EXPERIENCE_LEVELS, fmtDuration, inviteUrl, QUESTION_TYPE_LABEL, Select, shareUrl, SkillsInput, STATUS_BADGE, Toggle } from './ai-bits';
import { CodeEditor } from './code-editor';

/* ── Questions ──────────────────────────────────────────────── */
type QDraft = { text: string; description: string; type: QuestionType; options: string; timeLimitSeconds: string; isRequired: boolean; starterCode: { language: string; code: string } };
const emptyDraft: QDraft = { text: '', description: '', type: 'OPEN_ENDED', options: '', timeLimitSeconds: '', isRequired: true, starterCode: { language: 'javascript', code: '' } };
const isChoice = (t: QuestionType) => t === 'SINGLE_CHOICE' || t === 'MULTIPLE_CHOICE';

function QuestionModal({ interviewId, question, nextOrder, onClose }: { interviewId: string; question: AiQuestion | null; nextOrder: number; onClose: () => void }) {
  const add = useAddQuestion();
  const update = useUpdateQuestion();
  const [d, setD] = useState<QDraft>(question
    ? { text: question.text, description: question.description ?? '', type: question.type, options: (question.options?.options ?? []).join('\n'),
        timeLimitSeconds: question.timeLimitSeconds ? String(question.timeLimitSeconds) : '', isRequired: question.isRequired,
        starterCode: question.starterCode ?? emptyDraft.starterCode }
    : emptyDraft);
  const [error, setError] = useState('');
  const set = <K extends keyof QDraft>(k: K, v: QDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  const save = () => {
    const options = d.options.split('\n').map((o) => o.trim()).filter(Boolean);
    if (isChoice(d.type) && options.length < 2) return setError('Add at least two options (one per line).');
    const body = {
      text: d.text.trim(), description: d.description.trim() || null, type: d.type,
      options: isChoice(d.type) ? { options, allowMultiple: d.type === 'MULTIPLE_CHOICE' } : null,
      starterCode: d.type === 'CODING' ? d.starterCode : null,
      timeLimitSeconds: d.timeLimitSeconds ? Number(d.timeLimitSeconds) : null, isRequired: d.isRequired,
    } as Partial<AiQuestion>;
    const run = question ? update.mutateAsync({ id: question.id, body }) : add.mutateAsync({ interviewId, body: { ...body, order: nextOrder } });
    run.then(onClose).catch((e) => setError(apiErrorMessage(e)));
  };

  return (
    <Modal open onClose={onClose} title={question ? 'Edit question' : 'Add question'}
      footer={<><Btn v="outline" onClick={onClose}>Cancel</Btn><Btn v="primary" disabled={d.text.trim().length < 3} loading={add.isPending || update.isPending} onClick={save}>Save</Btn></>}>
      {error && <div className="mb-3"><Alert v="error">{error}</Alert></div>}
      <div className="space-y-4">
        <Textarea label="Question" rows={3} value={d.text} onChange={(e) => set('text', e.target.value)} />
        <Select label="Type" value={d.type} onChange={(e) => set('type', e.target.value as QuestionType)}>
          {Object.entries(QUESTION_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        {isChoice(d.type) && <Textarea label="Options (one per line)" rows={4} value={d.options} onChange={(e) => set('options', e.target.value)} />}
        {d.type === 'CODING' && (
          <div className="space-y-1.5">
            <div className="text-sm font-semibold text-gray-700">Starter Code</div>
            <p className="text-xs text-gray-500">Candidates get this template in a code editor. Add a signature and a comment, not the solution.</p>
            <CodeEditor height="200px" value={d.starterCode.code} language={d.starterCode.language}
              onChange={(code) => set('starterCode', { ...d.starterCode, code })} onLanguageChange={(language) => set('starterCode', { ...d.starterCode, language })} />
          </div>
        )}
        <Textarea label="Guidance for the AI (optional)" rows={2} value={d.description} onChange={(e) => set('description', e.target.value)} />
        <Input label="Time limit (seconds, optional)" type="number" min={0} value={d.timeLimitSeconds} onChange={(e) => set('timeLimitSeconds', e.target.value)} />
        <Toggle label="Required" checked={d.isRequired} onChange={(v) => set('isRequired', v)} />
      </div>
    </Modal>
  );
}

function QuestionsTab({ interview }: { interview: AiInterview }) {
  const questions = [...(interview.questions ?? [])].sort((a, b) => a.order - b.order);
  const del = useDeleteQuestion();
  const reorder = useReorderQuestions();
  const [editing, setEditing] = useState<AiQuestion | null | 'new'>(null);
  const [error, setError] = useState('');

  const move = (idx: number, dir: -1 | 1) => {
    const ids = questions.map((q) => q.id);
    [ids[idx], ids[idx + dir]] = [ids[idx + dir], ids[idx]];
    reorder.mutateAsync({ interviewId: interview.id, ids }).catch((e) => setError(apiErrorMessage(e)));
  };

  return (
    <>
      {error && <div className="mb-3"><Alert v="error">{error}</Alert></div>}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">The AI asks these in order and probes with follow-ups.</p>
        <Btn v="primary" sz="sm" icon={<Plus size={14} />} onClick={() => setEditing('new')}>Add question</Btn>
      </div>
      {questions.length === 0 ? (
        <EmptyState title="No questions yet" body="Add the questions the AI interviewer should work through." />
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <Card key={q.id}>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-green-xlt text-green text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">{q.text}</p>
                  {q.description && <p className="text-xs text-gray-400 mt-1">{q.description}</p>}
                  {q.options?.options?.length ? <p className="text-xs text-gray-500 mt-1">Options: {q.options.options.join(' · ')}</p> : null}
                  <div className="flex gap-2 mt-2"><Badge v="blue">{QUESTION_TYPE_LABEL[q.type]}</Badge>{q.timeLimitSeconds ? <Badge v="gray">{q.timeLimitSeconds}s</Badge> : null}{!q.isRequired && <Badge v="gray">Optional</Badge>}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Btn v="ghost" sz="sm" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label="Move up" icon={<ArrowUp size={14} />} />
                  <Btn v="ghost" sz="sm" disabled={i === questions.length - 1 || reorder.isPending} onClick={() => move(i, 1)} aria-label="Move down" icon={<ArrowDown size={14} />} />
                  <Btn v="ghost" sz="sm" onClick={() => setEditing(q)} aria-label="Edit" icon={<Pencil size={14} />} />
                  <Btn v="ghost" sz="sm" loading={del.isPending && del.variables === q.id} aria-label="Delete" icon={<Trash2 size={14} />}
                    onClick={() => window.confirm('Delete this question?') && del.mutateAsync(q.id).catch((e) => setError(apiErrorMessage(e)))} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <QuestionModal interviewId={interview.id} question={editing === 'new' ? null : editing} nextOrder={questions.length} onClose={() => setEditing(null)} />}
    </>
  );
}

/* ── Settings ───────────────────────────────────────────────── */
function SettingsTab({ interview }: { interview: AiInterview }) {
  const update = useUpdateInterview();
  const [f, setF] = useState(() => ({ ...interview }));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setF({ ...interview }), [interview.id, interview.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof AiInterview>(k: K, v: AiInterview[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = () =>
    update.mutateAsync({
      id: interview.id,
      body: {
        title: f.title, description: f.description, objective: f.objective, aiName: f.aiName, aiPersona: f.aiPersona, aiTone: f.aiTone,
        followUpDepth: f.followUpDepth, language: f.language, timeLimitMinutes: f.timeLimitMinutes, requireInvite: f.requireInvite,
        chatEnabled: f.chatEnabled, voiceEnabled: f.voiceEnabled, videoEnabled: f.videoEnabled, antiCheatingEnabled: f.antiCheatingEnabled,
        requiredSkills: f.requiredSkills ?? [], experienceLevel: f.experienceLevel ?? null,
      },
    }).then(() => setMsg({ ok: true, text: 'Settings saved.' })).catch((e) => setMsg({ ok: false, text: apiErrorMessage(e) }));

  return (
    <Card>
      {msg && <div className="mb-4"><Alert v={msg.ok ? 'success' : 'error'}>{msg.text}</Alert></div>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Input label="Title" value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="sm:col-span-2"><Textarea label="Description" rows={2} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="sm:col-span-2"><Textarea label="Objective — what should this interview find out?" rows={3} value={f.objective ?? ''} onChange={(e) => set('objective', e.target.value)} /></div>
        <Input label="Interviewer name" value={f.aiName} onChange={(e) => set('aiName', e.target.value)} />
        <Select label="Tone" value={f.aiTone} onChange={(e) => set('aiTone', e.target.value as AiInterview['aiTone'])}>
          {['CASUAL', 'PROFESSIONAL', 'FORMAL', 'FRIENDLY'].map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
        </Select>
        <Select label="Follow-up depth" value={f.followUpDepth} onChange={(e) => set('followUpDepth', e.target.value as AiInterview['followUpDepth'])}>
          <option value="LIGHT">Light — scripted questions only</option><option value="MODERATE">Moderate — up to 2 follow-ups</option><option value="DEEP">Deep — up to 5 follow-ups</option>
        </Select>
        <Select label="Language" value={f.language} onChange={(e) => set('language', e.target.value)}>
          <option value="en">English</option><option value="zh">中文</option>
        </Select>
        <Input label="Time limit (minutes)" type="number" min={1} value={f.timeLimitMinutes ?? ''} onChange={(e) => set('timeLimitMinutes', e.target.value ? Number(e.target.value) : null)} />
        <div className="sm:col-span-2"><SkillsInput label="Required skills" hint="Candidates whose skills match are shown this interview in their Open Interviews list." value={f.requiredSkills ?? []} onChange={(v) => set('requiredSkills', v)} /></div>
        <Select label="Experience level" value={f.experienceLevel ?? ''} onChange={(e) => set('experienceLevel', e.target.value || null)}>
          <option value="">Not specified</option>{EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
        <div className="sm:col-span-2"><Textarea label="Persona notes (optional)" rows={2} value={f.aiPersona ?? ''} onChange={(e) => set('aiPersona', e.target.value)} /></div>
      </div>
      <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
        <Toggle label="Text chat" checked={f.chatEnabled} onChange={(v) => set('chatEnabled', v)} />
        <Toggle label="Voice" hint="Candidates speak with the AI interviewer" checked={f.voiceEnabled} onChange={(v) => set('voiceEnabled', v)} />
        <Toggle label="Video" checked={f.videoEnabled} onChange={(v) => set('videoEnabled', v)} />
        <Toggle label="Invite only" hint="Only candidates on your invite list can join" checked={f.requireInvite} onChange={(v) => set('requireInvite', v)} />
        <Toggle label="Anti-cheating monitoring" hint="Logs tab switches, pasting and focus loss" checked={f.antiCheatingEnabled} onChange={(v) => set('antiCheatingEnabled', v)} />
      </div>
      <div className="mt-5 flex justify-end"><Btn v="primary" loading={update.isPending} disabled={!f.title.trim()} onClick={save}>Save settings</Btn></div>
    </Card>
  );
}

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v.trim());

/* ── Candidates ─────────────────────────────────────────────── */
function CandidatesTab({ interviewId }: { interviewId: string }) {
  const { data, isLoading } = useAiCandidates(interviewId);
  const add = useAddCandidate();
  const invite = useInviteByEmail();
  const bulk = useAddCandidates();
  const del = useDeleteCandidates();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const candidates = data?.candidates ?? [];

  /** Saves the invite and emails the personal link; always reports success or failure to the user. */
  const sendInvite = (inviteName: string | undefined, inviteEmail: string, onDone?: () => void) => {
    if (!isValidEmail(inviteEmail)) { toast.error('Enter a valid email address'); setMsg({ ok: false, text: 'Enter a valid email address' }); return Promise.resolve(); }
    return invite.mutateAsync({ interviewId, body: { name: inviteName, email: inviteEmail } }).then((r) => {
      onDone?.();
      if (r.emailSent) { toast.success(`Invitation emailed to ${inviteEmail}`); setMsg({ ok: true, text: `Invitation emailed to ${inviteEmail}.` }); }
      else { toast.error(`Invite saved, but the email was not sent: ${r.emailError ?? 'unknown error'}`); setMsg({ ok: false, text: `Invite saved for ${inviteEmail}, but the email was not sent: ${r.emailError ?? 'unknown error'} You can still use Copy link.` }); }
    }).catch((e) => { toast.error(apiErrorMessage(e)); setMsg({ ok: false, text: apiErrorMessage(e) }); });
  };

  const parseBulk = () =>
    paste.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [n, e] = line.split(/[,\t;]/).map((x) => x.trim());
      return e ? { name: n, email: e } : line.includes('@') ? { name: line.split('@')[0], email: line } : { name: n };
    });

  return (
    <>
      {msg && <div className="mb-3"><Alert v={msg.ok ? 'success' : 'error'}>{msg.text}</Alert></div>}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[10rem]"><Input label="Name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="flex-1 min-w-[12rem]"><Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Btn v="primary" icon={<Plus size={14} />} disabled={!name.trim() && !email.trim()} loading={add.isPending || invite.isPending}
            onClick={() => {
              // With an email: create/reuse the personal link and email it. Without one: just add the candidate (copy the link later).
              if (!email.trim()) {
                return add.mutateAsync({ interviewId, body: { name: name.trim(), email: null } })
                  .then(() => { setName(''); setMsg(null); }).catch((e) => setMsg({ ok: false, text: apiErrorMessage(e) }));
              }
              return sendInvite(name.trim() || undefined, email.trim(), () => { setName(''); setEmail(''); });
            }}>Invite</Btn>
          <Btn v="outline" icon={<Upload size={14} />} onClick={() => setShowBulk(true)}>Bulk add</Btn>
        </div>
      </Card>

      {isLoading ? <LoadingState /> : candidates.length === 0 ? (
        <EmptyState title="No candidates invited" body="Add candidates to get a personal interview link for each." />
      ) : (
        <div className="space-y-2">
          {candidates.map((c) => (
            <Card key={c.id}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy text-sm">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.email ?? 'No email'} · added {timeAgo(c.createdAt)}</div>
                </div>
                <Badge v={c.session ? STATUS_BADGE[c.session.status]?.v ?? 'gray' : 'gray'}>{c.session ? STATUS_BADGE[c.session.status]?.label : 'Not started'}</Badge>
                {c.email && <Btn v="outline" sz="sm" icon={<Mail size={13} />} loading={invite.isPending && invite.variables?.body.email === c.email}
                  onClick={() => void sendInvite(c.name, c.email!)}>Email invite</Btn>}
                {c.inviteToken && <Btn v="outline" sz="sm" icon={<Copy size={13} />}
                  onClick={async () => setMsg({ ok: true, text: (await copyText(inviteUrl(c.inviteToken!))) ? `Invite link for ${c.name} copied.` : inviteUrl(c.inviteToken!) })}>Copy link</Btn>}
                <Btn v="ghost" sz="sm" aria-label="Remove" icon={<Trash2 size={14} />} loading={del.isPending && del.variables?.[0] === c.id}
                  onClick={() => window.confirm(`Remove ${c.name}?`) && del.mutateAsync([c.id])} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showBulk} onClose={() => setShowBulk(false)} title="Bulk add candidates"
        footer={<><Btn v="outline" onClick={() => setShowBulk(false)}>Cancel</Btn>
          <Btn v="primary" loading={bulk.isPending} disabled={!paste.trim()}
            onClick={() => bulk.mutateAsync({ interviewId, rows: parseBulk() }).then((r) => { setMsg({ ok: true, text: `Added ${r.created} candidate(s).` }); setPaste(''); setShowBulk(false); })
              .catch((e) => setMsg({ ok: false, text: apiErrorMessage(e) }))}>Add</Btn></>}>
        <Textarea label="One candidate per line: name, email" rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Asha Rao, asha@example.com\nJohn Smith, john@example.com'} />
      </Modal>
    </>
  );
}

/* ── Sessions ───────────────────────────────────────────────── */
function SessionsTab({ interviewId }: { interviewId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useAiSessions({ interviewId });
  const sessions = data?.sessions ?? [];
  if (isLoading) return <LoadingState />;
  if (!sessions.length) return <EmptyState title="No sessions yet" body="Sessions appear here once a candidate starts the interview." />;
  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <Card key={s.id} hover onClick={() => navigate({ to: '/employer/ai/sessions/$sessionId', params: { sessionId: s.id } })}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-navy text-sm truncate">{s.participantName || s.participantEmail || 'Anonymous'}</div>
              <div className="text-xs text-gray-400">{fmtDuration(s.totalDurationSeconds)} · {s._count?.messages ?? 0} messages · {timeAgo(s.createdAt)}</div>
            </div>
            <Badge v={STATUS_BADGE[s.status]?.v ?? 'gray'}>{STATUS_BADGE[s.status]?.label ?? s.status}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ── Editor shell ───────────────────────────────────────────── */
export function AiInterviewEditor({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: interview, isLoading, error } = useAiInterview(id);
  const publish = usePublishInterview();
  const unpublish = useUnpublishInterview();
  const remove = useDeleteInterviews();
  const [tab, setTab] = useState('questions');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (isLoading) return <EmployerShell><LoadingState msg="Loading interview…" /></EmployerShell>;
  if (error || !interview) return <EmployerShell><Alert v="error">{apiErrorMessage(error, 'Interview not found.')}</Alert></EmployerShell>;

  const live = interview.isActive && !!interview.publicSlug;
  const fail = (e: unknown) => setMsg({ ok: false, text: apiErrorMessage(e) });

  const preview = async () => {
    try {
      if (!interview.publicSlug) await publish.mutateAsync(id); // preview sessions need a published interview
      const { sessionId } = await createPreviewSession(id);
      window.open(`/i/session/${sessionId}?preview=1`, '_blank');
    } catch (e) { fail(e); }
  };

  return (
    <EmployerShell>
      <button type="button" onClick={() => navigate({ to: '/employer/ai/interviews' })} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy mb-3">
        <ArrowLeft size={14} /> All interviews
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-display font-bold text-navy">{interview.title}</h1><Badge v={live ? 'green' : 'gray'}>{live ? 'Live' : 'Draft'}</Badge></div>
          {live && <p className="text-xs text-gray-400 mt-1">{shareUrl(interview.publicSlug!)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn v="outline" icon={<ExternalLink size={14} />} onClick={preview}>Preview</Btn>
          {live && <Btn v="outline" icon={<Copy size={14} />} onClick={async () => setMsg({ ok: true, text: (await copyText(shareUrl(interview.publicSlug!))) ? 'Share link copied.' : shareUrl(interview.publicSlug!) })}>Copy link</Btn>}
          {live
            ? <Btn v="outline" loading={unpublish.isPending} onClick={() => unpublish.mutateAsync(id).catch(fail)}>Unpublish</Btn>
            : <Btn v="primary" loading={publish.isPending} disabled={!(interview.questions?.length)} onClick={() => publish.mutateAsync(id).then(() => setMsg({ ok: true, text: 'Published. Share the link with candidates.' })).catch(fail)}>Publish</Btn>}
          <Btn v="ghost" aria-label="Delete interview" icon={<Trash2 size={14} />} loading={remove.isPending}
            onClick={() => window.confirm('Delete this interview and all its sessions?') && remove.mutateAsync([id]).then(() => navigate({ to: '/employer/ai/interviews' })).catch(fail)} />
        </div>
      </div>
      {msg && <div className="mb-4"><Alert v={msg.ok ? 'success' : 'error'}>{msg.text}</Alert></div>}

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'questions', label: `Questions (${interview.questions?.length ?? 0})` },
        { key: 'settings', label: 'Settings' },
        { key: 'candidates', label: 'Candidates' },
        { key: 'sessions', label: `Sessions (${interview._count?.sessions ?? 0})` },
      ]} />
      {tab === 'questions' && <QuestionsTab interview={interview} />}
      {tab === 'settings' && <SettingsTab interview={interview} />}
      {tab === 'candidates' && <CandidatesTab interviewId={id} />}
      {tab === 'sessions' && <SessionsTab interviewId={id} />}
    </EmployerShell>
  );
}
