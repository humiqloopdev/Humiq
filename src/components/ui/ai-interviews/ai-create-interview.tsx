// src/components/ui/ai-interviews/ai-create-interview.tsx
// "Create Interview": AI Generator tab (describe a goal, optionally attach a JD / resume, review and refine
// the generated interview) and a Manual tab (basics first, questions added later in the editor).
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight, BrainCircuit, Briefcase, Check, Code2, Copy, FileText, Globe, ListOrdered, Loader2, MessageSquare, MessageSquareText,
  Mic, PenLine, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Target, Trash2, Users, Video, X,
} from 'lucide-react';
import { Alert, Badge, Btn, Card, Input, Modal, Textarea } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { apiErrorMessage, cn } from '@/lib/utils';
import {
  extractText, listAllQuestions, streamInterview, useCreateInterview, type AiTone, type FollowUpDepth, type GeneratedInterview, type GeneratedQuestion,
} from '@/api/aiInterviews/useAiInterviews';
import { AI_TONES, EXPERIENCE_LEVELS, FOLLOW_UP_DEPTHS, LANGUAGES, Select, SkillsInput, Switch } from './ai-bits';
import { AiQuestionCard, type QuestionCardData } from './ai-question-card';

/* ── Prompt templates (chips under the textarea) ────────────── */
type Segment = string | { text: string; highlight: true };
interface Range { start: number; end: number }
const h = (text: string): Segment => ({ text, highlight: true });
const TEMPLATES: { label: string; icon: ElementType; segments: Segment[] }[] = [
  { label: 'Tech Hiring', icon: Code2, segments: ['Assess ', h('Senior Software Engineer'), ' candidates with ', h('8'), ' questions covering ', h('open-ended, coding, multiple-choice, and whiteboard'), ' types, focusing on ', h('practical problem-solving and technical depth'), '.'] },
  { label: 'Behavioral', icon: Users, segments: ['Conduct a ', h('behavioral interview'), ' with ', h('6'), ' questions mixing ', h('open-ended and single-choice'), ' formats to evaluate ', h('leadership, teamwork, and conflict resolution'), '.'] },
  { label: 'User Research', icon: Search, segments: ['Conduct ', h('user research interviews'), ' with ', h('6'), ' ', h('open-ended'), ' questions to understand ', h('product usage patterns, pain points, and unmet user needs'), '.'] },
  { label: 'Screening Call', icon: Briefcase, segments: ['Design a ', h('screening call'), ' with ', h('5'), ' questions mixing ', h('open-ended, single-choice, and coding'), ' to quickly evaluate ', h('technical fundamentals and communication skills'), '.'] },
  { label: 'Case Study', icon: BrainCircuit, segments: ['Design a ', h('case study interview'), ' with ', h('4'), ' questions including ', h('whiteboard, multiple-choice, and open-ended'), ' problem analysis.'] },
  { label: 'Expert Interview', icon: MessageSquareText, segments: ['Conduct an ', h('expert interview'), ' with ', h('5'), ' ', h('open-ended and research'), ' questions to explore ', h('domain expertise, industry trends, and strategic recommendations'), ' for the ', h('AI industry'), '.'] },
];

const segText = (segs: Segment[]) => segs.map((s) => (typeof s === 'string' ? s : s.text)).join('');
function rangesOf(segs: Segment[]): Range[] {
  const out: Range[] = [];
  let pos = 0;
  for (const s of segs) {
    const t = typeof s === 'string' ? s : s.text;
    if (typeof s !== 'string') out.push({ start: pos, end: pos + t.length });
    pos += t.length;
  }
  return out;
}
/** Keeps highlight ranges aligned with the text while the user edits around them. */
function adjustRanges(ranges: Range[], oldText: string, newText: string): Range[] {
  if (!ranges.length) return ranges;
  let s = 0;
  const min = Math.min(oldText.length, newText.length);
  while (s < min && oldText[s] === newText[s]) s++;
  let oe = oldText.length;
  let ne = newText.length;
  while (oe > s && ne > s && oldText[oe - 1] === newText[ne - 1]) { oe--; ne--; }
  const delta = ne - s - (oe - s);
  return ranges
    .map(({ start: rs, end: re }) => {
      if (re <= s) return { start: rs, end: re };
      if (rs >= oe) return { start: rs + delta, end: re + delta };
      if (rs <= s && re >= oe) return { start: rs, end: re + delta };
      if (rs >= s && re <= oe) return { start: s, end: ne };
      if (rs >= s && rs < oe) return { start: ne, end: re + delta };
      if (re > s && re <= oe) return { start: rs, end: s };
      return { start: rs, end: re };
    })
    .filter((r) => r.start < r.end);
}
function segmentsOf(text: string, ranges: Range[]): Segment[] {
  if (!ranges.length || !text) return text ? [text] : [];
  const out: Segment[] = [];
  let pos = 0;
  for (const { start, end } of [...ranges].sort((a, b) => a.start - b.start)) {
    if (start > pos) out.push(text.slice(pos, start));
    if (end > start) out.push({ text: text.slice(start, end), highlight: true });
    pos = end;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

/* ── Shared settings blocks ─────────────────────────────────── */
interface ChannelState { chat: boolean; voice: boolean; video: boolean; antiCheating: boolean }

function ChannelFields({ v, onChange }: { v: ChannelState; onChange: (v: ChannelState) => void }) {
  const row = (icon: React.ReactNode, title: string, sub: string, control: React.ReactNode) => (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-3"><span className="text-gray-400">{icon}</span><div><div className="text-sm font-semibold text-navy">{title}</div><div className="text-xs text-gray-400">{sub}</div></div></div>
      {control}
    </div>
  );
  return (
    <>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-gray-700">Communication Channels</div>
        <p className="text-xs text-gray-400">Choose how participants interact during the interview. At least one channel must be enabled.</p>
        <div className="rounded-xl border border-gray-200 px-3 divide-y divide-gray-100">
          {row(<MessageSquare size={16} />, 'Chat', 'Text messaging', <Switch label="Chat" checked={v.chat} onChange={(c) => { if (!c && !v.voice) return; onChange({ ...v, chat: c }); }} />)}
          {row(<Mic size={16} />, 'Voice', 'Speech conversation', <Switch label="Voice" checked={v.voice} onChange={(c) => { if (!c && !v.chat) return; onChange({ ...v, voice: c, video: c ? v.video : false }); }} />)}
          {row(<Video size={16} />, 'Video', 'Camera & screen recording', <Switch label="Video" checked={v.video} disabled={!v.voice} onChange={(c) => onChange({ ...v, video: c })} />)}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-gray-700">Anti-Cheating Mode</div>
        <div className="rounded-xl border border-gray-200 px-3 py-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-400"><ShieldCheck size={16} /></span>
              <div><div className="text-sm font-semibold text-navy">Enable Anti-Cheating</div>
                <div className="text-xs text-gray-400">Requires camera, mic & screen sharing. Monitors tab switches, blocks external paste, and detects multiple screens</div></div>
            </div>
            <Switch label="Anti-cheating" checked={v.antiCheating} onChange={(c) => onChange({ ...v, antiCheating: c })} />
          </div>
          {v.antiCheating && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold">When enabled, interviewees will experience:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>Camera, microphone, and screen sharing will be mandatory (cannot be skipped)</li>
                <li>Tab switching and window focus loss will be tracked and flagged</li>
                <li>Pasting content from outside the interview page will be blocked</li>
                <li>Multiple screens will be detected and flagged</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5"><div className="text-sm font-semibold text-gray-700">{label}</div>{children}</div>
);

/* ── Import existing questions ──────────────────────────────── */
function ImportDialog({ open, onClose, onImport, existing }: { open: boolean; onClose: () => void; onImport: (q: GeneratedQuestion[]) => void; existing: string[] }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAllQuestions>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPicked([]);
    listAllQuestions().then(setRows).catch((e) => setError(apiErrorMessage(e))).finally(() => setLoading(false));
  }, [open]);

  const visible = rows.filter((r) => !existing.includes(r.text) && `${r.text} ${r.interview.title}`.toLowerCase().includes(query.toLowerCase()));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal open={open} onClose={onClose} title="Import Existing Questions"
      footer={<><Btn v="outline" onClick={onClose}>Cancel</Btn>
        <Btn v="primary" disabled={!picked.length} onClick={() => {
          onImport(rows.filter((r) => picked.includes(r.id)).map((r, i) => ({
            order: i + 1, text: r.text, type: r.type, description: r.description, isRequired: r.isRequired, timeLimitSeconds: r.timeLimitSeconds,
            options: r.options, followUpPrompts: r.followUpPrompts, starterCode: r.starterCode,
          })));
          onClose();
        }}>Import {picked.length || ''}</Btn></>}>
      {error && <div className="mb-3"><Alert v="error">{error}</Alert></div>}
      <Input placeholder="Search questions..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mt-3 max-h-72 overflow-y-auto space-y-1.5">
        {loading && <div className="py-6 text-center text-sm text-gray-400"><Loader2 className="inline animate-spin mr-2" size={14} />Loading…</div>}
        {!loading && visible.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No questions to import.</p>}
        {visible.map((r) => (
          <label key={r.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-2.5 cursor-pointer hover:border-green/40">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-green" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} />
            <span className="min-w-0"><span className="block text-sm text-navy">{r.text}</span><span className="block text-xs text-gray-400 mt-0.5">{r.interview.title}</span></span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

/* ── AI Generator tab ───────────────────────────────────────── */
function AiGenerator() {
  const navigate = useNavigate();
  const create = useCreateInterview();

  const [description, setDescription] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<number | null>(null);
  const [ranges, setRanges] = useState<Range[]>([]);
  const prevDesc = useRef('');
  const [duration, setDuration] = useState('20');
  const [skills, setSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [language, setLanguage] = useState('en');
  const [tone, setTone] = useState<AiTone>('FRIENDLY');
  const [depth, setDepth] = useState<FollowUpDepth>('MODERATE');
  const [channels, setChannels] = useState<ChannelState>({ chat: true, voice: true, video: true, antiCheating: false });

  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'writing'>('idle');
  const [thinking, setThinking] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const streamEnd = useRef<HTMLDivElement>(null);

  const [result, setResult] = useState<GeneratedInterview | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [criteria, setCriteria] = useState<{ name: string; description: string }[]>([]);
  const [editingQ, setEditingQ] = useState<number | null>(null);
  const [editingC, setEditingC] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Context documents (job description / resume)
  const [jd, setJd] = useState({ text: '', source: '', loading: false, error: '' });
  const [resume, setResume] = useState({ text: '', source: '', loading: false, error: '' });
  const [jdOpen, setJdOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [jdUrl, setJdUrl] = useState('');
  const jdFile = useRef<HTMLInputElement>(null);
  const resumeFile = useRef<HTMLInputElement>(null);

  useEffect(() => { streamEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [thinking, content]);

  const load = async (kind: 'jd' | 'resume', source: { file?: File; url?: string }) => {
    const set = kind === 'jd' ? setJd : setResume;
    set((x) => ({ ...x, loading: true, error: '' }));
    try {
      const text = await extractText(source);
      set({ text, source: source.file?.name ?? source.url ?? '', loading: false, error: '' });
    } catch (e) {
      set((x) => ({ ...x, loading: false, error: apiErrorMessage(e, 'Failed to extract text') }));
    }
  };

  const applyResult = (data: GeneratedInterview) => {
    setResult(data);
    setCriteria(data.assessmentCriteria ?? []);
    setQuestions(data.questions.map((q, i) => ({ ...q, order: i + 1, starterCode: q.starterCode ? { ...q.starterCode, language: q.starterCode.language.toLowerCase() } : null })));
    setEditingQ(null);
    setEditingC(null);
  };

  const languageLabel = LANGUAGES.find((l) => l.value === language)?.label ?? language;
  const onEvent = (e: Parameters<Parameters<typeof streamInterview>[2]>[0]) => {
    if (e.type === 'thinking') { setPhase('thinking'); setThinking((t) => t + e.text); }
    else if (e.type === 'content') { setPhase('writing'); setContent((t) => t + e.text); }
    else if (e.type === 'status') setStatus(e.message);
  };
  const resetStream = () => { setPhase('idle'); setThinking(''); setContent(''); setStatus(''); };
  const context = { ...(jd.text && { jobDescription: jd.text }), ...(resume.text && { resumeText: resume.text }) };

  const generate = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setError('');
    setResult(null);
    setFeedback('');
    resetStream();
    try {
      applyResult(await streamInterview('generate', { description, durationMinutes: Number(duration) || 20, language: languageLabel, ...context }, onEvent));
    } catch (e) {
      setError(apiErrorMessage(e, 'Generation failed. Please try again or create the interview manually.'));
    } finally {
      setGenerating(false);
      setPhase('idle');
    }
  };

  const refine = async () => {
    if (!result || !feedback.trim()) return;
    setRefining(true);
    setError('');
    resetStream();
    try {
      const data = await streamInterview('refine', {
        interview: { title: result.title, description: result.description, objective: result.objective, assessmentCriteria: criteria, questions: questions.map((q) => ({ text: q.text, type: q.type })) },
        feedback, language: languageLabel, ...context,
      }, onEvent);
      applyResult(data);
      setFeedback('');
    } catch (e) {
      setError(apiErrorMessage(e, 'Refinement failed. Please try again.'));
    } finally {
      setRefining(false);
      setPhase('idle');
    }
  };

  const accept = async () => {
    if (!result || !questions.length) return;
    setSaving(true);
    setError('');
    try {
      const interview = await create.mutateAsync({
        title: result.title, description: result.description, objective: result.objective,
        assessmentCriteria: criteria.length ? criteria : undefined,
        chatEnabled: channels.chat, voiceEnabled: channels.voice, videoEnabled: channels.video, antiCheatingEnabled: channels.antiCheating,
        language, aiTone: tone, aiName: result.recommendedSettings?.aiName ?? 'Humiq Loop', followUpDepth: depth, timeLimitMinutes: Number(duration) || undefined,
        requiredSkills: skills, experienceLevel: experience || null,
        questions: questions.map((q) => ({
          text: q.text, type: q.type, description: q.description ?? null, timeLimitSeconds: q.timeLimitSeconds ?? null, isRequired: q.isRequired ?? true,
          options: q.options ?? null, followUpPrompts: q.followUpPrompts ?? null, starterCode: q.type === 'CODING' ? q.starterCode ?? null : null,
        })),
      });
      navigate({ to: '/employer/ai/interviews/$id', params: { id: interview.id } });
    } catch (e) {
      setError(apiErrorMessage(e, 'Something went wrong saving the interview.'));
      setSaving(false);
    }
  };

  // Drag-and-drop reordering of generated questions
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const drop = (to: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    setDragOver(null);
    if (from === null || from === to) return;
    setQuestions((prev) => { const next = [...prev]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next.map((q, i) => ({ ...q, order: i + 1 })); });
    setEditingQ(null);
  };

  const segments = ranges.length ? segmentsOf(description, ranges) : null;
  const hasHighlight = segments?.some((s) => typeof s !== 'string') ?? false;
  const fileInput = useCallback((kind: 'jd' | 'resume') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void load(kind, { file });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const chip = (src: string, icon: React.ReactNode, onClear: () => void) => (
    <span className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-navy">
      {icon}<span className="max-w-[180px] truncate">{src}</span>
      <button type="button" aria-label="Remove" className="rounded-full p-0.5 text-gray-400 hover:text-navy" onClick={onClear}><X size={12} /></button>
    </span>
  );
  const busy = generating || refining;
  const streamPanel = busy && (thinking || content) && (
    <Card>
      <div className="space-y-3">
        {thinking && (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-1">
              {phase === 'thinking' && <Loader2 size={12} className="animate-spin" />}{phase === 'thinking' ? 'Thinking...' : 'Thinking complete'}
            </div>
            <div className={cn('overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-500 whitespace-pre-wrap', phase === 'thinking' ? 'max-h-40' : 'max-h-20')}>{thinking}</div>
          </div>
        )}
        {content && (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-1">
              {phase === 'writing' && <Loader2 size={12} className="animate-spin" />}{phase === 'writing' ? 'Writing interview...' : 'Finalizing...'}
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-3 font-mono text-[11px] text-gray-600 whitespace-pre-wrap">{content}</div>
          </div>
        )}
        {status && <p className="text-xs text-amber-700">{status}</p>}
        <div ref={streamEnd} />
      </div>
    </Card>
  );
  const buttonLabel = generating ? (phase === 'thinking' ? 'Thinking...' : phase === 'writing' ? 'Writing...' : 'Generating...') : 'Generate Interview';

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="flex items-center gap-2 text-xl font-display font-bold text-navy"><Sparkles size={20} />AI Interview Generator</h2>
        <p className="text-sm text-gray-500 mt-1">Describe your goal in natural language and AI will create a complete interview structure for you.</p>

        <div className="space-y-5 mt-5">
          <Field label="What kind of interview do you need?">
            <div className="relative rounded-xl border border-gray-200 bg-white focus-within:border-green focus-within:ring-2 focus-within:ring-green/20 transition-all">
              <input ref={jdFile} type="file" accept=".pdf" className="hidden" onChange={fileInput('jd')} />
              <input ref={resumeFile} type="file" accept=".pdf" className="hidden" onChange={fileInput('resume')} />

              {(jd.text || resume.text || jd.loading || resume.loading || jd.error || resume.error) && (
                <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5 pb-1">
                  {jd.loading && <span className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500"><Loader2 size={13} className="animate-spin" />Extracting JD...</span>}
                  {jd.text && chip(jd.source, jd.source.startsWith('http') ? <Globe size={13} className="text-gray-400" /> : <Briefcase size={13} className="text-gray-400" />, () => setJd({ text: '', source: '', loading: false, error: '' }))}
                  {jd.error && <span className="text-xs text-red-600">{jd.error}</span>}
                  {resume.loading && <span className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500"><Loader2 size={13} className="animate-spin" />Extracting resume...</span>}
                  {resume.text && chip(resume.source, <FileText size={13} className="text-gray-400" />, () => setResume({ text: '', source: '', loading: false, error: '' }))}
                  {resume.error && <span className="text-xs text-red-600">{resume.error}</span>}
                </div>
              )}

              <div className="relative">
                <textarea
                  id="ai-description"
                  rows={4}
                  placeholder="e.g. I want to assess senior React developers for our fintech startup, focusing on system design and problem-solving skills..."
                  value={description}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRanges((r) => adjustRanges(r, prevDesc.current, next));
                    prevDesc.current = next;
                    setDescription(next);
                    setActiveTemplate(null);
                  }}
                  className={cn('block w-full resize-y min-h-[128px] bg-transparent border-0 outline-none px-3 py-2.5 pb-10 text-sm text-gray-800 placeholder-gray-400', hasHighlight && 'text-transparent caret-gray-800 selection:bg-green/20')}
                />
                {hasHighlight && segments && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-10 overflow-hidden whitespace-pre-wrap break-words px-3 py-2.5 text-sm text-gray-800">
                    {segments.map((s, i) => (typeof s === 'string' ? <span key={i}>{s}</span> : <mark key={i} className="rounded-[3px] bg-green/10 text-green">{s.text}</mark>))}
                  </div>
                )}
              </div>

              <div className="absolute bottom-2 right-4 flex items-center gap-1.5">
                <div className="relative">
                  <button type="button" onClick={() => { setJdOpen((o) => !o); setResumeOpen(false); }}
                    className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors', jd.text ? 'bg-green/10 text-green' : 'text-gray-500 hover:bg-gray-100 hover:text-navy')}>
                    {jd.loading ? <Loader2 size={13} className="animate-spin" /> : <Briefcase size={13} />}JD
                  </button>
                  {jdOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg z-20">
                      {jd.text ? (
                        <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-gray-50" onClick={() => { setJd({ text: '', source: '', loading: false, error: '' }); setJdOpen(false); }}><X size={14} />Remove JD</button>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="block px-1 text-xs font-semibold text-gray-500">Paste JD link</label>
                          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                            <Globe size={13} className="text-gray-400 flex-shrink-0" />
                            <input autoFocus type="text" placeholder="https://..." value={jdUrl} onChange={(e) => setJdUrl(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (jdUrl.trim()) { void load('jd', { url: jdUrl.trim() }); setJdUrl(''); setJdOpen(false); } } }}
                              className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400" />
                            {jdUrl.trim() && <button type="button" aria-label="Fetch" className="text-green" onClick={() => { void load('jd', { url: jdUrl.trim() }); setJdUrl(''); setJdOpen(false); }}><ArrowRight size={14} /></button>}
                          </div>
                          <div className="relative text-center text-xs text-gray-400"><span className="bg-white px-2 relative z-10">or</span><div className="absolute inset-x-0 top-1/2 border-t border-gray-100" /></div>
                          <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50" onClick={() => { jdFile.current?.click(); setJdOpen(false); }}><FileText size={14} />Upload PDF</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button type="button" onClick={() => { setResumeOpen((o) => !o); setJdOpen(false); }}
                    className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors', resume.text ? 'bg-green/10 text-green' : 'text-gray-500 hover:bg-gray-100 hover:text-navy')}>
                    {resume.loading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}Resume
                  </button>
                  {resumeOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-lg z-20">
                      {resume.text
                        ? <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50" onClick={() => { setResume({ text: '', source: '', loading: false, error: '' }); setResumeOpen(false); }}><X size={14} />Remove Resume</button>
                        : <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50" onClick={() => { resumeFile.current?.click(); setResumeOpen(false); }}><FileText size={14} />Upload PDF</button>}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TEMPLATES.map((t, i) => (
                <button key={t.label} type="button"
                  className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors', activeTemplate === i ? 'border-green bg-green/10 text-green' : 'border-gray-200 text-gray-500 hover:border-green/40 hover:text-navy')}
                  onClick={() => { const text = segText(t.segments); setDescription(text); prevDesc.current = text; setActiveTemplate(i); setRanges(rangesOf(t.segments)); }}>
                  <t.icon size={12} />{t.label}
                </button>
              ))}
            </div>
          </Field>

          <SkillsInput label="Required skills" hint="Used to show this interview to candidates with matching skills." value={skills} onChange={setSkills} />
          <Select label="Experience level" value={experience} onChange={(e) => setExperience(e.target.value)}>
            <option value="">Not specified</option>{EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Duration (min)" type="number" min={5} max={120} value={duration} onChange={(e) => setDuration(e.target.value)} />
            <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</Select>
            <Select label="Tone" value={tone} onChange={(e) => setTone(e.target.value as AiTone)}>{AI_TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
            <Select label="Follow-up Depth" value={depth} onChange={(e) => setDepth(e.target.value as FollowUpDepth)}>
              {FOLLOW_UP_DEPTHS.map((d) => <option key={d.value} value={d.value}>{d.label} ({d.description})</option>)}
            </Select>
          </div>

          <ChannelFields v={channels} onChange={setChannels} />

          {error && !result && <Alert v="error">{error}</Alert>}
          <Btn v="primary" sz="lg" block loading={generating} disabled={!description.trim() || busy} icon={<Sparkles size={15} />} onClick={generate}>{buttonLabel}</Btn>
        </div>
      </Card>

      {generating && streamPanel}

      {result && (
        <Card>
          <h2 className="text-xl font-display font-bold text-navy">{result.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{result.objective}</p>
          <div className="flex flex-wrap gap-2 pt-3">
            {channels.chat && <Badge v="green">Chat</Badge>}{channels.voice && <Badge v="green">Voice</Badge>}{channels.video && <Badge v="green">Video</Badge>}
            <Badge v="gray">{tone}</Badge><Badge v="gray">~{result.estimatedDurationMinutes} min</Badge><Badge v="gray">{questions.length} questions</Badge>
          </div>

          <div className="space-y-6 mt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-navy"><ListOrdered size={16} />Questions ({questions.length})</div>
              <div className="space-y-1.5">
                {questions.map((q, i) => (
                  <AiQuestionCard key={`q-${i}-${q.text.slice(0, 12)}`} data={q as QuestionCardData} index={i} editing={editingQ === i}
                    onStartEdit={() => setEditingQ(i)} onCancel={() => setEditingQ(null)}
                    onSave={(u) => { setQuestions((p) => p.map((x, j) => (j === i ? { ...x, ...u } : x))); setEditingQ(null); }}
                    onDelete={() => { setQuestions((p) => p.filter((_, j) => j !== i).map((x, j) => ({ ...x, order: j + 1 }))); setEditingQ(null); }}
                    dragProps={{
                      draggable: editingQ !== i,
                      onDragStart: (e) => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move'; },
                      onDragOver: (e) => { e.preventDefault(); setDragOver(i); },
                      onDragLeave: () => setDragOver(null),
                      onDrop: (e) => { e.preventDefault(); drop(i); },
                      onDragEnd: () => { dragFrom.current = null; setDragOver(null); },
                    }}
                    className={cn(dragOver === i && dragFrom.current !== i && 'border-green bg-green/5', dragFrom.current === i && 'opacity-50')} />
                ))}
              </div>
              <div className="flex gap-2">
                <Btn v="outline" sz="sm" className="flex-1 border-dashed" icon={<Plus size={13} />}
                  onClick={() => { setQuestions((p) => [...p, { order: p.length + 1, text: '', type: 'OPEN_ENDED', description: '', isRequired: true, followUpPrompts: [] }]); setEditingQ(questions.length); }}>Add New</Btn>
                <Btn v="outline" sz="sm" className="flex-1 border-dashed" icon={<Copy size={13} />} onClick={() => setImportOpen(true)}>Import Existing</Btn>
              </div>
            </div>
            <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} existing={questions.map((q) => q.text)}
              onImport={(imported) => setQuestions((p) => [...p, ...imported.map((q, i) => ({ ...q, order: p.length + i + 1 }))])} />

            <div className="border-t border-gray-100" />

            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-navy"><Target size={16} />Assessment Criteria ({criteria.length})</div>
              {criteria.length === 0 && <p className="py-1 text-sm text-gray-400">No assessment criteria defined yet.</p>}
              <div className="space-y-1.5">
                {criteria.map((c, i) => (
                  <div key={i} className="group flex items-start gap-2 rounded-xl border border-gray-200 px-3 py-2 hover:border-green/40">
                    {editingC === i ? (
                      <div className="flex-1 space-y-2">
                        <Input value={c.name} placeholder="Criterion name..." onChange={(e) => setCriteria((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                        <Textarea rows={2} value={c.description} placeholder="What this criterion measures..." onChange={(e) => setCriteria((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                        <div className="flex justify-between">
                          <Btn v="ghost" sz="sm" icon={<Trash2 size={13} />} onClick={() => { setCriteria((p) => p.filter((_, j) => j !== i)); setEditingC(null); }}>Delete</Btn>
                          <Btn v="primary" sz="sm" icon={<Check size={13} />} disabled={!c.name.trim()} onClick={() => setEditingC(null)}>Done</Btn>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-navy">{c.name}</div><div className="text-xs text-gray-500">{c.description}</div></div>
                        <button type="button" aria-label="Edit criterion" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-navy opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => setEditingC(i)}><PenLine size={14} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <Btn v="outline" sz="sm" block className="border-dashed" icon={<Plus size={13} />} onClick={() => { setCriteria((p) => [...p, { name: '', description: '' }]); setEditingC(criteria.length); }}>Add Criterion</Btn>
            </div>

            <div className="border-t border-gray-100" />

            <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-navy"><MessageSquareText size={16} />Refine with AI</div>
              <p className="text-xs text-gray-500">Describe what you&apos;d like to change and AI will update the questions.</p>
              <Textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={refining}
                placeholder={'e.g. "Make the questions harder", "Add more behavioral questions", "Remove the ice-breaker"...'} />
              <Btn v="primary" loading={refining} disabled={!feedback.trim() || busy} icon={<Sparkles size={14} />} onClick={refine}>{refining ? (phase === 'thinking' ? 'Thinking...' : phase === 'writing' ? 'Writing...' : 'Refining...') : 'Refine'}</Btn>
              {refining && streamPanel}
            </div>

            {error && <Alert v="error">{error}</Alert>}
            <div className="flex gap-3 border-t border-gray-100 pt-4">
              <Btn v="primary" loading={saving} disabled={!questions.length || busy} icon={<Check size={15} />} onClick={accept}>Accept &amp; Create</Btn>
              <Btn v="outline" disabled={busy} icon={<RefreshCw size={15} />} onClick={generate}>Regenerate All</Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Manual tab ─────────────────────────────────────────────── */
function ManualCreate() {
  const navigate = useNavigate();
  const create = useCreateInterview();
  const [f, setF] = useState({ title: '', description: '', objective: '', duration: '' });
  const [skills, setSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [channels, setChannels] = useState<ChannelState>({ chat: true, voice: true, video: true, antiCheating: false });
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    create.mutateAsync({
      title: f.title.trim(), description: f.description || undefined, objective: f.objective || undefined,
      chatEnabled: channels.chat, voiceEnabled: channels.voice, videoEnabled: channels.video, antiCheatingEnabled: channels.antiCheating,
      aiTone: 'FRIENDLY', followUpDepth: 'MODERATE', language: 'en', timeLimitMinutes: f.duration ? Number(f.duration) : undefined,
      requiredSkills: skills, experienceLevel: experience || null,
    }).then((i) => navigate({ to: '/employer/ai/interviews/$id', params: { id: i.id } })).catch((err) => setError(apiErrorMessage(err)));
  };

  return (
    <Card>
      <h2 className="text-xl font-display font-bold text-navy">Create Manually</h2>
      <p className="text-sm text-gray-500 mt-1">Set up the basics, then add questions in the editor.</p>
      <form onSubmit={submit} className="space-y-5 mt-5">
        {error && <Alert v="error">{error}</Alert>}
        <Input label="Title" required placeholder="e.g. Senior React Developer Interview" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Textarea label="Description" placeholder="Brief description of this interview..." value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Textarea label="Objective" placeholder="What do you want to learn from this interview?" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} />
        <SkillsInput label="Required skills" hint="Used to show this interview to candidates with matching skills." value={skills} onChange={setSkills} />
        <Select label="Experience level" value={experience} onChange={(e) => setExperience(e.target.value)}>
          <option value="">Not specified</option>{EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
        <Input label="Duration (minutes)" type="number" min={1} max={120} placeholder="e.g. 30" hint="Optional. Recommended time limit for the interview." value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} />
        <ChannelFields v={channels} onChange={setChannels} />
        <Btn v="primary" sz="lg" block type="submit" loading={create.isPending} disabled={f.title.trim().length < 2}>Create Interview</Btn>
      </form>
    </Card>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export function AiCreateInterview() {
  const [tab, setTab] = useState<'ai' | 'manual'>('ai');
  const tabs = useMemo(() => [{ key: 'ai' as const, label: 'AI Generator', icon: <Sparkles size={15} /> }, { key: 'manual' as const, label: 'Manual', icon: <PenLine size={15} /> }], []);
  return (
    <EmployerShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-display font-bold text-navy">Create Interview</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Build manually or let AI generate an interview for you.</p>
        <div role="tablist" className="grid grid-cols-2 rounded-xl bg-gray-100 p-1 mb-6">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => setTab(t.key)}
              className={cn('flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all', tab === t.key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy')}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        {/* Both tabs stay mounted so switching keeps their drafts. */}
        <div className={tab === 'ai' ? '' : 'hidden'}><AiGenerator /></div>
        <div className={tab === 'manual' ? '' : 'hidden'}><ManualCreate /></div>
      </div>
    </EmployerShell>
  );
}
