// src/components/ui/ai-interviews/ai-voice-room.tsx
// Voice interview: speaks with the AI interviewer through the relay servers in talentai-backend/voice-relay.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Loader2, Mic, MicOff, PanelRightClose, PanelRightOpen, PhoneOff } from 'lucide-react';
import { Alert, Btn } from '@/components/ui/common';
import { apiErrorMessage, cn } from '@/lib/utils';
import { useVoice, type InterviewContext } from '@/hooks/use-voice';
import { postMessage, type RoomSession } from '@/api/aiInterviews/aiInterviewsApi';
import { InterviewerAvatar, type AvatarState } from './interviewer-avatar';
import { CodeWorkspace, defaultStarter, newSnippet, type Snippet } from './code-workspace';

interface Turn {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

const WAVE = [0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.7, 0.45, 0.85, 0.55, 0.95, 0.6, 0.8, 0.45, 0.7, 0.5, 0.9, 0.6];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function AiVoiceRoom({ session, preview, onDone }: { session: RoomSession; preview?: boolean; onDone: () => void }) {
  const { interview } = session;
  const questions = useMemo(() => [...interview.questions].sort((a, b) => a.order - b.order), [interview.questions]);
  const startIndex = Math.max(0, questions.findIndex((q) => q.id === session.currentQuestionId));

  const interviewContext = useMemo<InterviewContext>(() => ({
    title: interview.title,
    objective: interview.objective,
    aiName: interview.aiName,
    aiTone: interview.aiTone,
    language: interview.language,
    followUpDepth: interview.followUpDepth,
    startQuestionIndex: startIndex,
    questions: questions.map((q) => ({
      text: q.text, type: q.type, description: q.description, options: q.options, starterCode: q.starterCode, order: q.order,
    })),
  }), [interview, questions, startIndex]);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);

  const addTurn = useCallback((role: Turn['role'], text: string) => {
    if (!text.trim()) return;
    setTurns((t) => [...t, { id: nextId.current++, role, text }]);
  }, []);

  const voice = useVoice({
    interviewId: interview.id,
    sessionId: session.id,
    interviewContext,
    onTranscript: (text, isFinal) => { if (isFinal) addTurn('user', text); },
    onAIResponse: (text) => addTurn('assistant', text),
    onError: (e) => { setError(e); setStarting(false); },
  });

  // Code editor for CODING questions. Edits are streamed to the voice agent (debounced) so it can discuss the code;
  // "Submit code" also saves it to the session so it appears in the report.
  const currentQuestion = questions[voice.currentQuestionIndex];
  const [drafts, setDrafts] = useState<Record<string, { snippets: Snippet[]; active: number }>>({});
  const starter = currentQuestion?.starterCode ?? defaultStarter('javascript');
  const work = currentQuestion ? drafts[currentQuestion.id] ?? { snippets: [newSnippet(starter)], active: 0 } : null;
  const draft = work ? work.snippets[Math.min(work.active, work.snippets.length - 1)] : null;
  const [savingCode, setSavingCode] = useState(false);
  const [codeDone, setCodeDone] = useState<Record<string, boolean>>({}); // coding questions already submitted
  const sendCodeUpdate = voice.sendCodeUpdate;
  useEffect(() => {
    if (!draft || currentQuestion?.type !== 'CODING' || !voice.isConnected) return;
    const t = window.setTimeout(() => sendCodeUpdate(draft.code, draft.language), 600);
    return () => window.clearTimeout(t);
  }, [draft?.code, draft?.language, currentQuestion?.id, currentQuestion?.type, voice.isConnected, sendCodeUpdate]); // eslint-disable-line react-hooks/exhaustive-deps
  const submitCode = async () => {
    if (!currentQuestion || !draft?.code.trim() || savingCode) return;
    setSavingCode(true);
    setError('');
    try {
      await postMessage(session.id, {
        content: draft.code, contentType: 'CODE', questionId: currentQuestion.id,
        whiteboardData: { label: `Question ${voice.currentQuestionIndex + 1}`, language: draft.language, code: draft.code },
      });
      addTurn('user', `[Submitted ${draft.language} code for question ${voice.currentQuestionIndex + 1}]`);
      setCodeDone((d) => ({ ...d, [currentQuestion.id]: true }));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save your code. Please try again.'));
    } finally {
      setSavingCode(false);
    }
  };

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    setEnding(true);
    try { await voice.disconnect(); } finally { onDone(); }
  }, [voice, onDone]);

  // The interviewer decided the conversation is over, or the server's time limit was hit.
  useEffect(() => {
    if (voice.isInterviewComplete || voice.timeLimitExceeded) void finish();
  }, [voice.isInterviewComplete, voice.timeLimitExceeded, finish]);

  useEffect(() => { if (voice.isConnected) setStarting(false); }, [voice.isConnected]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns]);

  // Elapsed timer while connected; auto-ends when the interview's time limit is reached.
  const limitSeconds = interview.timeLimitMinutes ? interview.timeLimitMinutes * 60 : null;
  useEffect(() => {
    if (!voice.isConnected) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [voice.isConnected]);
  useEffect(() => { if (limitSeconds && elapsed >= limitSeconds) void finish(); }, [elapsed, limitSeconds, finish]);

  const status = ending ? 'Wrapping up…' : voice.isSpeaking ? `${interview.aiName} is speaking` : voice.isProcessing ? 'Thinking…' : voice.isListening ? 'Listening…' : voice.isConnected ? 'Mic is muted' : 'Not connected';
  const connect = async () => {
    setError('');
    setStarting(true);
    try {
      await voice.connect();
      await voice.startListening();
    } catch {
      setStarting(false);
      setError('Could not start the voice interview. Check that the voice relay is running and microphone access is allowed.');
    }
  };

  const avatarState: AvatarState = voice.isSpeaking ? 'speaking' : voice.isProcessing ? 'thinking' : voice.isListening ? 'listening' : 'idle';
  const [showTranscript, setShowTranscript] = useState(true);
  const total = Math.max(1, voice.totalQuestions);
  const qNumber = Math.min(voice.currentQuestionIndex + 1, total);
  const timeLeft = limitSeconds ? Math.max(0, limitSeconds - elapsed) : null;
  // While a coding question is open the editor takes the stage and the avatar shrinks below it; after submitting, the normal view returns.
  const isCoding = voice.isConnected && currentQuestion?.type === 'CODING' && !codeDone[currentQuestion.id];
  const live = voice.userTranscript || voice.aiTranscript;

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 pt-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display font-bold text-navy truncate">{interview.title}</div>
            <div className="text-xs text-gray-500">Voice Interview with {interview.aiName}</div>
          </div>
          {preview && <span className="text-[11px] font-semibold border border-gray-300 rounded-full px-2.5 py-0.5 text-gray-600">Preview</span>}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex-1 h-1.5 rounded-full bg-green-lt overflow-hidden">
            <div className="h-full bg-green transition-all duration-500" style={{ width: `${(qNumber / total) * 100}%` }} />
          </div>
          <span className="text-xs text-gray-500 shrink-0">Q{qNumber} / {total}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1.5">Question {qNumber}</div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <main className={cn('flex-1 min-w-0 min-h-0 overflow-hidden px-6 flex flex-col items-center', isCoding ? 'py-3' : 'py-6')}>
          <div className={cn('w-full flex-1 min-h-0 flex flex-col items-center text-center', isCoding ? 'max-w-6xl' : 'max-w-xl justify-center')}>
            {error && <div className="w-full mb-4 text-left"><Alert v="error">{error}</Alert></div>}

            {!voice.isConnected ? (
              <>
                <InterviewerAvatar state="idle" />
                <h2 className="text-xl font-display font-bold text-navy mt-4">Voice interview with {interview.aiName}</h2>
                <p className="text-sm text-gray-500 mt-2 max-w-md">Find a quiet place and allow microphone access when your browser asks. Speak naturally; you can mute at any time.</p>
                <div className="mt-5">
                  <Btn v="primary" sz="lg" loading={starting} icon={<Mic size={16} />} onClick={connect}>{starting ? 'Connecting…' : 'Start voice interview'}</Btn>
                </div>
              </>
            ) : (
              isCoding && work ? (
                <>
                  <CodeWorkspace
                    className="flex-1 min-h-0 w-full text-left rounded-xl border border-gray-200 overflow-hidden"
                    problem={currentQuestion.text} hint={currentQuestion.description ?? undefined} starter={starter}
                    snippets={work.snippets} active={work.active}
                    onChange={(snippets, active) => setDrafts((d) => ({ ...d, [currentQuestion.id]: { snippets, active } }))}
                    status={{ speaker: interview.aiName, speaking: voice.isSpeaking, listening: voice.isListening, heard: voice.userTranscript || undefined }}
                    onSubmit={() => void submitCode()} submitting={savingCode} />
                  <div className="w-full flex items-center gap-4 mt-3 text-left">
                    <InterviewerAvatar state={avatarState} size={72} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-green-dk">{status}</div>
                      {voice.isSpeaking
                        ? <p className="text-sm text-navy font-medium mt-1"><span className="rounded bg-yellow-200 px-1.5 py-0.5 box-decoration-clone">{currentQuestion.text}</span></p>
                        : live && <p className="text-xs text-gray-500 italic truncate">{live}</p>}
                    </div>
                  </div>
                </>
              ) : (
              <>
                <InterviewerAvatar state={avatarState} />
                <div className="mt-2 text-sm font-semibold text-green-dk">{status}</div>
                <div className="flex items-center justify-center gap-[3px] h-8 mt-1.5" aria-hidden>
                  {WAVE.map((w, i) => avatarState === 'speaking' ? (
                    <span key={i} className="av-bar w-[3px] h-full rounded-full bg-green" style={{ animationDelay: `${(i % 6) * 0.09}s`, transform: `scaleY(${w})` }} />
                  ) : (
                    <span key={i} className="w-[3px] rounded-full bg-green/70 transition-all"
                      style={{ height: `${12 + (avatarState === 'listening' ? Math.min(1, voice.audioLevel * 1.6) * w * 88 : 0)}%` }} />
                  ))}
                </div>
                {currentQuestion && (
                  <p className="text-base text-gray-700 mt-4 max-w-xl leading-relaxed">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Current question</span>
                    <span className={cn('inline rounded px-1.5 py-0.5 transition-colors box-decoration-clone', voice.isSpeaking ? 'bg-yellow-200 text-navy font-medium' : '')}>{currentQuestion.text}</span>
                  </p>
                )}
                {voice.userTranscript && <p className="text-sm text-gray-500 italic mt-3 max-w-lg line-clamp-2">{voice.userTranscript}</p>}
                {voice.isTransitioning && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-3">
                    <Loader2 size={12} className="animate-spin" /> Moving to the {voice.transitionDirection === 'previous' ? 'previous' : 'next'} question…
                  </p>
                )}
              </>
              )
            )}
          </div>
        </main>

        <aside className={cn('border-l border-gray-200 bg-white flex flex-col transition-all', showTranscript ? 'w-80 xl:w-96' : 'w-12')}>
          <button type="button" onClick={() => setShowTranscript((v) => !v)}
            className="flex items-center justify-between px-4 h-10 border-b border-gray-200 text-xs font-semibold text-navy cursor-pointer">
            {showTranscript && <span>Transcript</span>}
            {showTranscript ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} className="mx-auto" />}
          </button>
          {showTranscript && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
              {turns.length === 0 && <p className="text-xs text-gray-400">The conversation will appear here.</p>}
              {turns.map((t) => (
                <p key={t.id} className="text-gray-700 leading-relaxed">
                  <b className={t.role === 'user' ? 'text-green-dk' : 'text-navy'}>{t.role === 'user' ? 'You' : interview.aiName}: </b>{t.text}
                </p>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </aside>
      </div>

      <footer className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-center relative">
        <div className="flex items-end gap-5">
          <ToolBtn label={voice.isListening ? 'Mute' : 'Unmute'} active={voice.isListening} disabled={!voice.isConnected}
            onClick={() => (voice.isListening ? voice.stopListening() : void voice.startListening())}>
            {voice.isListening ? <Mic size={18} /> : <MicOff size={18} />}
          </ToolBtn>
          <ToolBtn label="Previous" disabled={!voice.isConnected || voice.currentQuestionIndex === 0 || voice.isTransitioning}
            onClick={() => void voice.previousQuestion()}><ChevronLeft size={18} /></ToolBtn>
          <ToolBtn label="Next" disabled={!voice.isConnected || voice.currentQuestionIndex >= voice.totalQuestions - 1 || voice.isTransitioning}
            onClick={() => void voice.nextQuestion()}><ChevronRight size={18} /></ToolBtn>
          <ToolBtn label="End" danger disabled={!voice.isConnected || ending}
            onClick={() => window.confirm('End the interview now?') && void finish()}><PhoneOff size={18} /></ToolBtn>
        </div>
        {voice.isConnected && (
          <span className="absolute right-6 flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 rounded-md px-3 py-1.5">
            <Clock size={13} />{timeLeft !== null ? `${clock(timeLeft)} left` : clock(elapsed)}
          </span>
        )}
      </footer>
    </div>
  );
}

function ToolBtn({ label, onClick, disabled, active, danger, children }: {
  label: string; onClick: () => void; disabled?: boolean; active?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
      <span className={cn('h-11 w-11 rounded-full flex items-center justify-center transition-colors',
        danger ? 'bg-red-600 text-white hover:bg-red-700' : active ? 'bg-green text-white' : 'bg-green-lt text-green-dk hover:bg-green-md hover:text-white')}>{children}</span>
      <span className="text-[11px] text-gray-500">{label}</span>
    </button>
  );
}
