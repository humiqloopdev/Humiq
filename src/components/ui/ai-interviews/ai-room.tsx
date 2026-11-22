// src/components/ui/ai-interviews/ai-room.tsx
// Public (login-free) candidate experience: join screen + chat interview room.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Clock, Mic, MessageSquare, Send, Sparkles } from 'lucide-react';
import { Alert, Btn, Card, Input, LoadingState } from '@/components/ui/common';
import { apiErrorMessage, cn } from '@/lib/utils';
import {
  chatTurn, completeSession, getInvite, getPublicInterview, getRoomSession, postMessage, reportViolation,
  setCurrentQuestion, startInviteSession, startSession, type AiMessage, type PublicInterview, type RoomSession,
} from '@/api/aiInterviews/aiInterviewsApi';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/store/toastStore';
import { AiVoiceRoom } from './ai-voice-room';
import { InterviewIntro } from '@/components/ui/candidate/interview-intro';
import { CodeBlock } from './code-editor';
import { CodeWorkspace, defaultStarter, newSnippet, type Snippet } from './code-workspace';

const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><div className="w-full max-w-2xl">{children}</div></div>
);

/* ── Join ───────────────────────────────────────────────────── */
export function AiJoin({ slug, token }: { slug?: string; token?: string }) {
  const navigate = useNavigate();
  const info = useQuery({
    queryKey: ['ai-public', slug ?? token],
    queryFn: async (): Promise<{ interview: PublicInterview; name?: string; email?: string | null }> =>
      token ? await getInvite(token) : { interview: await getPublicInterview(slug!) },
    retry: false,
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (info.data?.name) setName(info.data.name);
    if (info.data?.email) setEmail(info.data.email);
  }, [info.data]);

  const autoStarted = useRef(false);
  useEffect(() => {
    // Personal invite links skip the join card and go straight to the briefing.
    if (!token || !info.data || autoStarted.current) return;
    autoStarted.current = true;
    setBusy(true);
    startInviteSession(token)
      .then(({ sessionId }) => navigate({ to: '/i/session/$sessionId', params: { sessionId }, search: { preview: undefined } }))
      .catch((e) => { const m = apiErrorMessage(e); setError(m); toast.error(m); setBusy(false); });
  }, [token, info.data, navigate]);

  if (info.isLoading || (token && busy && !error)) return <Page><LoadingState msg="Loading interview…" /></Page>;
  if (info.error || !info.data) return <Page><Alert v="error">{apiErrorMessage(info.error, 'This interview link is not valid or is no longer active.')}</Alert></Page>;

  const { interview } = info.data;
  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const { sessionId } = token
        ? await startInviteSession(token)
        : await startSession({ interviewSlug: slug!, participantName: name.trim() || undefined, participantEmail: email.trim() || undefined });
      navigate({ to: '/i/session/$sessionId', params: { sessionId }, search: { preview: undefined } });
    } catch (e) {
      const m = apiErrorMessage(e);
      setError(m);
      toast.error(m);
      setBusy(false);
    }
  };

  return (
    <Page>
      <Card>
        <div className="flex items-center gap-2 text-green text-sm font-semibold mb-2"><Sparkles size={16} /> AI interview with {interview.aiName}</div>
        <h1 className="text-2xl font-display font-bold text-navy">{interview.title}</h1>
        {interview.description && <p className="text-sm text-gray-500 mt-2">{interview.description}</p>}
        <div className="flex gap-4 text-xs text-gray-400 mt-3">
          <span>{interview.questions.length} questions</span>
          {interview.timeLimitMinutes && <span className="flex items-center gap-1"><Clock size={12} />About {interview.timeLimitMinutes} min</span>}
        </div>
        {error && <div className="mt-4"><Alert v="error">{error}</Alert></div>}
        {!token && (
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label={interview.requireInvite ? 'Email (must match your invite)' : 'Email (optional)'} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        {token && <p className="text-sm text-gray-600 mt-5">Welcome, <b>{name}</b>. Your personal link is ready.</p>}
        <div className="mt-5"><Btn v="primary" sz="lg" block loading={busy} disabled={!token && (!name.trim() || (interview.requireInvite && !email.trim()))} onClick={start}>Start interview →</Btn></div>
      </Card>
    </Page>
  );
}

/* ── Room ───────────────────────────────────────────────────── */
// Typed answers and submitted code both go to the interviewer; code is sent as a fenced block so it can review it.
const toLlm = (msgs: AiMessage[]) =>
  msgs
    .filter((m) => m.role !== 'SYSTEM' && (m.contentType === 'TEXT' || m.contentType === 'CODE'))
    .map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.contentType === 'CODE' ? `Here is my code (${m.whiteboardData?.language ?? 'plaintext'}):\n\`\`\`${m.whiteboardData?.language ?? ''}\n${m.content}\n\`\`\`` : m.content,
    }));

export function AiRoom({ sessionId, preview }: { sessionId: string; preview?: boolean }) {
  const [session, setSession] = useState<RoomSession | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [done, setDone] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [mode, setMode] = useState<'chat' | 'voice' | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const questions = session?.interview.questions ?? [];
  const current = questions[qIndex];

  const finish = useCallback(async () => {
    await completeSession(sessionId).catch(() => undefined);
    setDone(true);
  }, [sessionId]);

  // One interviewer turn; `history` is the transcript so far (empty for the greeting).
  const runTurn = useCallback(async (history: AiMessage[], index: number, manual = false) => {
    setThinking(true);
    setError('');
    try {
      const r = await chatTurn(sessionId, { messages: toLlm(history), currentQuestionIndex: index, manualNavigation: manual });
      const reply: AiMessage = { id: `a-${Date.now()}`, role: 'ASSISTANT', content: r.content, contentType: 'TEXT', timestamp: new Date().toISOString() };
      setMessages((m) => [...m, reply]);
      if (r.questionAdvanced) setQIndex((i) => i + 1);
      if (r.isComplete) await finish();
    } catch (e) {
      setError(apiErrorMessage(e, 'The interviewer could not respond. Please try again.'));
    } finally {
      setThinking(false);
    }
  }, [sessionId, finish]);

  useEffect(() => {
    getRoomSession(sessionId).then((s) => {
      setSession(s);
      setMessages(s.messages.filter((m) => m.role !== 'SYSTEM'));
      const idx = s.interview.questions.findIndex((q) => q.id === s.currentQuestionId);
      setQIndex(Math.max(0, idx));
      if (s.status === 'COMPLETED') setDone(true);
      if (s.messages.length > 0) setIntroDone(true); // resumed session: skip the briefing
      const { chatEnabled, voiceEnabled } = s.interview;
      // No mode picker: voice whenever it's enabled (the checklist already tested the mic), except resumed text sessions.
      if (voiceEnabled && !(chatEnabled && s.messages.length > 0)) setMode('voice');
      else setMode('chat');
    }).catch((e) => setLoadError(apiErrorMessage(e, 'Session not found.')));
  }, [sessionId]);

  // Greeting for a fresh session.
  useEffect(() => {
    if (session && mode === 'chat' && !done && messages.length === 0 && !started.current) {
      started.current = true;
      void runTurn([], qIndex);
    }
  }, [session, mode, done, messages.length, qIndex, runTurn]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  // Keep the server's notion of the current question in step with the UI.
  useEffect(() => {
    if (session && current && !done) void setCurrentQuestion(sessionId, current.id).catch(() => undefined);
  }, [qIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Anti-cheating monitoring.
  useEffect(() => {
    if (!session?.interview.antiCheatingEnabled || done || preview) return;
    const log = (type: string, detail?: string) => void reportViolation(sessionId, { type, timestamp: Date.now(), detail }).catch(() => undefined);
    const onVis = () => document.hidden && log('tab_switch');
    const onBlur = () => log('focus_lost');
    const onPaste = () => log('paste');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('paste', onPaste);
    };
  }, [session, done, sessionId, preview]);

  const send = async (text: string, manual = false) => {
    const content = text.trim();
    if (!content || thinking) return;
    setInput('');
    setError('');
    const optimistic: AiMessage = { id: `u-${Date.now()}`, role: 'USER', content, contentType: 'TEXT', timestamp: new Date().toISOString() };
    const next = [...messages, optimistic];
    setMessages(next);
    try {
      await postMessage(sessionId, { content, questionId: current?.id });
    } catch (e) {
      setError(apiErrorMessage(e));
      return;
    }
    await runTurn(next, qIndex, manual);
  };

  // Code editor for CODING questions: one draft per question, starting from the question's starter code.
  const [drafts, setDrafts] = useState<Record<string, { snippets: Snippet[]; active: number }>>({});
  const starter = current?.starterCode ?? defaultStarter('javascript');
  const work = current ? drafts[current.id] ?? { snippets: [newSnippet(starter)], active: 0 } : null;
  const draft = work ? work.snippets[Math.min(work.active, work.snippets.length - 1)] : null;
  const [submittingCode, setSubmittingCode] = useState(false);
  const submitCode = async () => {
    if (!current || !draft || !draft.code.trim() || thinking || submittingCode) return;
    setError('');
    setSubmittingCode(true);
    const whiteboardData = { label: `Question ${qIndex + 1}`, language: draft.language, code: draft.code };
    const optimistic: AiMessage = { id: `u-${Date.now()}`, role: 'USER', content: draft.code, contentType: 'CODE', timestamp: new Date().toISOString(), whiteboardData };
    const next = [...messages, optimistic];
    setMessages(next);
    try {
      await postMessage(sessionId, { content: draft.code, contentType: 'CODE', questionId: current.id, whiteboardData });
    } catch (e) {
      setError(apiErrorMessage(e));
      setSubmittingCode(false);
      return;
    }
    setSubmittingCode(false);
    await runTurn(next, qIndex);
  };

  const choices = useMemo(() => (current && (current.type === 'SINGLE_CHOICE' || current.type === 'MULTIPLE_CHOICE') ? current.options?.options ?? [] : []), [current]);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [qIndex]);

  if (loadError) return <Page><Alert v="error">{loadError}</Alert></Page>;
  if (!session) return <Page><LoadingState msg="Joining interview…" /></Page>;

  if (done) {
    return (
      <Page>
        <Card>
          <div className="text-center py-6">
            <CheckCircle2 size={44} className="text-green mx-auto mb-3" />
            <h1 className="text-2xl font-display font-bold text-navy">Interview complete</h1>
            <p className="text-sm text-gray-500 mt-2">Thank you{session.participantName ? `, ${session.participantName}` : ''}. Your responses have been shared with the hiring team.</p>
            {preview && <p className="text-xs text-gray-400 mt-4">This was a preview session.</p>}
          </div>
        </Card>
      </Page>
    );
  }

  if (!introDone && !preview) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <InterviewIntro
          title={session.interview.title}
          userName={session.participantName ?? undefined}
          description={session.interview.description ?? undefined}
          questionCount={questions.length}
          minutes={session.interview.timeLimitMinutes ?? Math.max(1, questions.length * 4)}
          onNext={() => setIntroDone(true)}
        />
      </div>
    );
  }

  if (mode === null) {
    return (
      <Page>
        <Card>
          <h1 className="text-xl font-display font-bold text-navy">How would you like to interview?</h1>
          <p className="text-sm text-gray-500 mt-1">You can pick the way that suits you best.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <button type="button" onClick={() => setMode('voice')} className="rounded-xl border border-gray-200 p-4 text-left hover:border-green hover:bg-green-xlt/40 transition-all">
              <Mic size={20} className="text-green mb-2" /><div className="font-semibold text-navy text-sm">Voice</div><p className="text-xs text-gray-500 mt-1">Speak with the interviewer. Needs a microphone.</p>
            </button>
            {session.interview.chatEnabled && (
              <button type="button" onClick={() => setMode('chat')} className="rounded-xl border border-gray-200 p-4 text-left hover:border-green hover:bg-green-xlt/40 transition-all">
                <MessageSquare size={20} className="text-green mb-2" /><div className="font-semibold text-navy text-sm">Text chat</div><p className="text-xs text-gray-500 mt-1">Type your answers.</p>
              </button>
            )}
          </div>
        </Card>
      </Page>
    );
  }

  if (mode === 'voice') return <AiVoiceRoom session={session} preview={preview} onDone={() => setDone(true)} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-display font-bold text-navy truncate">{session.interview.title}</div>
          <div className="text-xs text-gray-400">Question {Math.min(qIndex + 1, questions.length)} of {questions.length}{preview ? ' · Preview' : ''}</div>
        </div>
        <Btn v="outline" sz="sm" onClick={() => window.confirm('End the interview now?') && void finish()}>End interview</Btn>
      </header>
      <div className="h-1 bg-gray-100"><div className="h-1 bg-green transition-all" style={{ width: `${(Math.min(qIndex, questions.length) / Math.max(1, questions.length)) * 100}%` }} /></div>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'USER' ? 'justify-end' : 'justify-start')}>
              {m.contentType === 'CODE'
                ? <div className="w-full max-w-[85%]"><CodeBlock code={m.content} language={m.whiteboardData?.language ?? 'plaintext'} right={<span className="normal-case">Submitted code</span>} /></div>
                : <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap', m.role === 'USER' ? 'bg-green text-white' : 'bg-white border border-gray-100 text-navy shadow-sm')}>{m.content}</div>}
            </div>
          ))}
          {thinking && <div className="text-xs text-gray-400 px-2">{session.interview.aiName} is typing…</div>}
          {error && <Alert v="error">{error}</Alert>}
          <div ref={endRef} />
        </div>
      </main>

      <footer className="bg-white border-t border-gray-100 px-4 py-3">
        <div className={cn('mx-auto', current?.type === 'CODING' ? 'max-w-6xl' : 'max-w-2xl')}>
          {choices.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {choices.map((c) => {
                const on = picked.includes(c);
                return (
                  <button key={c} type="button" onClick={() => setPicked((p) => (current!.type === 'SINGLE_CHOICE' ? [c] : on ? p.filter((x) => x !== c) : [...p, c]))}
                    className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-all', on ? 'border-green bg-green-xlt text-green' : 'border-gray-200 text-gray-600 hover:border-green')}>{c}</button>
                );
              })}
              <Btn v="primary" sz="sm" disabled={picked.length === 0 || thinking} onClick={() => { void send(`My answer: ${picked.join(', ')}`); setPicked([]); }}>Submit choice</Btn>
            </div>
          )}
          {current?.type === 'CODING' && work && (
            <CodeWorkspace
              className="mb-3 h-[46vh] min-h-[340px] rounded-xl border border-gray-200 overflow-hidden"
              problem={current.text} hint={current.description ?? undefined} starter={starter}
              snippets={work.snippets} active={work.active}
              onChange={(snippets, active) => setDrafts((d) => ({ ...d, [current.id]: { snippets, active } }))}
              onSubmit={() => void submitCode()} submitting={submittingCode} />
          )}
          <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
            <textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} disabled={thinking}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              placeholder="Type your answer… (Enter to send, Shift+Enter for a new line)"
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-green focus:ring-2 focus:ring-green/20" />
            <Btn v="primary" type="submit" loading={thinking} disabled={!input.trim()} icon={<Send size={15} />} aria-label="Send" />
          </form>
        </div>
      </footer>
    </div>
  );
}
