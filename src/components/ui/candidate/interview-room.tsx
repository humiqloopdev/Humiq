// src/components/ui/candidate/interview-room.tsx
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Clock, Code as CodeIcon, HelpCircle, MessageSquare, Mic, MicOff, PenLine, PhoneOff, SkipBack, SkipForward, Video, Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeWorkspace, defaultStarter, newSnippet, type Snippet } from '@/components/ui/ai-interviews/code-workspace';

const CATEGORY_LABEL: Record<string, string> = {
  technical_depth: 'Technical Depth', communication: 'Communication',
  system_design: 'System Design', problem_solving: 'Problem Solving',
};
import {
  apiErrorMessage, useEndInterview, useSubmitAnswer, type ApiInterviewEnd, type ApiInterviewSession,
} from '@/api/candidate/useCandidateQueries';

interface RecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
}
const getRecognition = (): (new () => RecognitionLike) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

type Panel = null | 'chat' | 'code' | 'whiteboard';
const MINUTES_PER_QUESTION = 4;

function ToolBtn({ icon, label, onClick, disabled, active, danger }: {
  icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean; danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
      <span className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
        danger ? 'bg-red text-white hover:opacity-90' : active ? 'bg-green text-white' : 'bg-green-lt text-green-dk hover:bg-green-xlt',
      )}>{icon}</span>
      <span className="text-[11px] text-gray-500">{label}</span>
    </button>
  );
}

function Whiteboard() {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (ref.current!.width / r.width), y: (e.clientY - r.top) * (ref.current!.height / r.height) };
  };
  return (
    <div className="w-full h-full flex flex-col">
      <canvas
        ref={ref} width={1200} height={700}
        className="flex-1 min-h-0 w-full bg-white rounded-xl border border-gray-200 touch-none cursor-crosshair"
        onPointerDown={(e) => { drawing.current = true; const c = ref.current!.getContext('2d')!; const p = pos(e); c.beginPath(); c.moveTo(p.x, p.y); }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const c = ref.current!.getContext('2d')!; const p = pos(e);
          c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = '#1A3A5C'; c.lineTo(p.x, p.y); c.stroke();
        }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }}
      />
      <button type="button" className="self-end mt-2 text-xs text-gray-500 hover:text-green cursor-pointer"
        onClick={() => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); }}>Clear board</button>
    </div>
  );
}

interface Props {
  sessionId: string;
  questions: ApiInterviewSession['questions'];
  title?: string;
  onSummary: (s: ApiInterviewEnd) => void;
}

export function InterviewRoom({ sessionId, questions, title = 'AI Interview Assessment', onSummary }: Props) {
  const submit = useSubmitAnswer(sessionId);
  const end = useEndInterview(sessionId);

  const existing = Object.fromEntries(questions.filter((q) => q.transcript).map((q) => [q.id, q.transcript as string]));
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((q) => !q.transcript)));
  const [answers, setAnswers] = useState<Record<string, string>>(existing);
  const [codes, setCodes] = useState<Record<string, { snippets: Snippet[]; active: number }>>({});
  const [speaking, setSpeaking] = useState(false);
  const [heard, setHeard] = useState('');
  const [saved, setSaved] = useState<Record<string, string>>(existing);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(questions.length * MINUTES_PER_QUESTION * 60);
  const [cameraOn, setCameraOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const finishRef = useRef<(force?: boolean) => void>(() => {});
  const SpeechRec = getRecognition();

  const q = questions[index];
  const last = index === questions.length - 1;
  const busy = submit.isPending || end.isPending;
  const starter = defaultStarter('javascript');
  const work = codes[q.id] ?? { snippets: [newSnippet(starter)], active: 0 };
  // Typed/spoken answer plus every snippet the candidate actually changed from the starter template.
  const valueOf = (id: string) => {
    const snippets = (codes[id]?.snippets ?? []).filter((s) => s.code.trim() && s.code.trim() !== defaultStarter(s.language).code.trim());
    const code = snippets.map((s) => `[Code: ${s.language}]\n${s.code.trim()}`).join('\n\n');
    return `${(answers[id] ?? '').trim()}${code ? `\n\n${code}` : ''}`.trim();
  };
  const current = valueOf(q.id);
  const intro = `Hello! I'm your AI interviewer, and I'll be guiding you through this assessment. We'll cover ${questions.length} questions together today. Let's get started. `;
  const spoken = index === 0 ? `${intro}${q.question_text}` : q.question_text;

  /* ── voice: dictate the answer ── */
  const stopListening = () => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setInterim('');
  };
  const toggleMic = () => {
    if (listening) return stopListening();
    if (!SpeechRec) return;
    window.speechSynthesis?.cancel();
    setHeard('');
    const rec = new SpeechRec();
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    const qid = q.id;
    rec.onresult = (e) => {
      let finalText = ''; let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else partial += r[0].transcript;
      }
      setInterim(partial);
      if (partial || finalText) setHeard((partial || finalText).trim());
      if (finalText.trim()) setAnswers((a) => ({ ...a, [qid]: `${a[qid] ? `${a[qid]} ` : ''}${finalText.trim()}` }));
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    rec.onerror = () => { setListening(false); setInterim(''); };
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  /* ── voice: read the question aloud ── */
  useEffect(() => {
    stopListening();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    return () => { window.speechSynthesis.cancel(); setSpeaking(false); };
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── camera preview ── */
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: true }).then((s) => {
      if (cancelled) return s.getTracks().forEach((t) => t.stop());
      stream = s;
      setCameraOn(true);
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = s; });
    }).catch(() => {});
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  /* ── countdown; auto-submit at zero ── */
  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (secondsLeft === 0) finishRef.current(true); }, [secondsLeft]);
  useEffect(() => () => { recRef.current?.stop(); }, []);

  /* ── saving / navigation ── */
  const saveCurrent = async () => {
    const value = valueOf(q.id);
    if (!value || saved[q.id] === value) return true;
    try {
      await submit.mutateAsync({ questionId: q.id, text: value });
      setSaved((s) => ({ ...s, [q.id]: value }));
      setError('');
      return true;
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save your answer'));
      return false;
    }
  };
  // Autosave so the "Saved" indicator in the code screen is accurate.
  useEffect(() => {
    if (!current || saved[q.id] === current) return;
    const t = window.setTimeout(() => { void saveCurrent(); }, 1500);
    return () => window.clearTimeout(t);
  }, [current, index]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (delta: number) => {
    stopListening();
    if (await saveCurrent()) setIndex((i) => Math.min(questions.length - 1, Math.max(0, i + delta)));
  };
  const finish = async (force = false) => {
    stopListening();
    if (!(await saveCurrent())) return;
    const unanswered = questions.filter((x) => !valueOf(x.id)).length;
    if (!force && unanswered > 0 && !window.confirm(`${unanswered} question${unanswered > 1 ? 's are' : ' is'} unanswered. Submit anyway?`)) return;
    try {
      onSummary(await end.mutateAsync());
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not submit the interview'));
    }
  };
  finishRef.current = finish;

  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const togglePanel = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* header */}
      <header className="px-6 pt-4 pb-2.5 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold text-navy truncate">{title}</h1>
            <p className="text-xs text-gray-500">Voice Interview with AI Interviewer</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 bg-red-lt text-red text-[11px] font-semibold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />REC
            </span>
            <span className="bg-green text-white text-xs font-semibold px-3 py-1 rounded-full">Connected</span>
            <HelpCircle size={18} className="text-gray-500" aria-label="Help" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-1.5 rounded-full bg-green-lt overflow-hidden">
            <div className="h-full bg-green transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
          </div>
          <span className="text-xs text-gray-600 tabular-nums">Q{index + 1} / {questions.length}</span>
        </div>
        <p className="text-xs text-gray-600 mt-2 truncate">{q.question_text}</p>
      </header>

      {error && <div className="mx-6 mb-2 text-xs bg-red-lt text-red rounded-lg px-3 py-2">{error}</div>}

      {/* body */}
      <div className="flex flex-1 min-h-0 border-t border-gray-200">
        <main className={cn('flex-1 min-w-0 bg-gray-50 flex overflow-auto', panel === 'code' ? 'flex-col' : 'p-6 items-center justify-center')}>
          {panel === 'code' && (
            <CodeWorkspace
              className="flex-1 bg-white"
              problem={q.question_text} hint={`Tests the candidate's skills in ${(CATEGORY_LABEL[q.category] ?? q.category).toLowerCase()}.`}
              starter={starter} snippets={work.snippets} active={work.active}
              onChange={(snippets, active) => setCodes((c) => ({ ...c, [q.id]: { snippets, active } }))}
              status={{ speaker: 'AI Interviewer', speaking, listening, heard: heard || undefined }}
              saveState={submit.isPending ? 'saving' : !current || saved[q.id] === current ? 'saved' : 'unsaved'} />
          )}
          {panel === null && (
            <div className="max-w-xl text-center">
              <p className="italic text-sm text-gray-700 leading-relaxed line-clamp-4">{spoken}</p>
              <p className="mt-8 text-sm text-gray-700 flex items-center justify-center gap-2">
                {listening
                  ? <><Mic size={16} className="text-green animate-pulse" />Listening… {interim && <span className="text-gray-400 italic">{interim}</span>}</>
                  : SpeechRec ? 'Click the mic to start speaking'
                  : 'Voice input is not supported in this browser. Use Chat to type your answer.'}
              </p>
            </div>
          )}
          {panel === 'chat' && (
            <div className="w-full max-w-2xl h-full flex flex-col">
              <label className="text-xs font-semibold text-navy mb-2">Type your answer</label>
              <textarea
                className="flex-1 min-h-48 w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green"
                placeholder="Type your answer here…" maxLength={10000} value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              />
            </div>
          )}
          {panel === 'whiteboard' && <div className="w-full max-w-4xl h-full"><Whiteboard /></div>}
        </main>

        {/* transcript */}
        <aside className={cn('border-l border-gray-200 bg-white flex flex-col shrink-0 transition-all', showTranscript ? 'w-[380px] max-w-[45vw]' : 'w-10')}>
          <button type="button" onClick={() => setShowTranscript((v) => !v)}
            className="flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-700 border-b border-gray-200 cursor-pointer">
            {showTranscript && 'Transcript'}
            {showTranscript ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          {showTranscript && (
            <div className="flex-1 overflow-auto px-4 py-4 space-y-4 text-sm leading-relaxed">
              {questions.slice(0, index + 1).map((x, i) => (
                <div key={x.id} className="space-y-3">
                  <p className="flex gap-2">
                    <Volume2 size={13} className="mt-1.5 shrink-0 text-gray-500" />
                    <span><b className="font-medium text-green">AI Interviewer: </b>{i === 0 ? intro : ''}{x.question_text}</span>
                  </p>
                  {valueOf(x.id) && <p className="pl-5 whitespace-pre-wrap"><b className="font-medium text-navy">You: </b>{valueOf(x.id)}</p>}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* camera preview */}
      {cameraOn && (
        <div className="absolute right-4 bottom-20 w-36 h-28 rounded-lg overflow-hidden shadow-hover bg-gray-100 z-10">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
          <span className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded"><Video size={10} />Camera</span>
        </div>
      )}

      {/* toolbar */}
      <footer className="relative h-[76px] shrink-0 border-t border-gray-200 flex items-center justify-center gap-5 bg-white">
        <ToolBtn icon={listening ? <Mic size={16} /> : <MicOff size={16} />} label={listening ? 'Mute' : 'Unmute'} active={listening} disabled={!SpeechRec} onClick={toggleMic} />
        <ToolBtn icon={<MessageSquare size={16} />} label="Chat" active={panel === 'chat'} onClick={() => togglePanel('chat')} />
        <ToolBtn icon={<PenLine size={16} />} label="Whiteboard" active={panel === 'whiteboard'} onClick={() => togglePanel('whiteboard')} />
        <ToolBtn icon={<CodeIcon size={16} />} label="Code" active={panel === 'code'} onClick={() => togglePanel('code')} />
        <ToolBtn icon={<SkipBack size={16} />} label="Previous" disabled={index === 0 || busy} onClick={() => go(-1)} />
        <ToolBtn icon={<SkipForward size={16} />} label={last ? 'Submit' : 'Next'} disabled={busy} onClick={() => (last ? finish() : go(1))} />
        <ToolBtn icon={<PhoneOff size={16} />} label="End" danger disabled={busy} onClick={() => finish()} />
        <span className="absolute right-6 bottom-4 flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-lg tabular-nums">
          <Clock size={13} />{mmss} left
        </span>
      </footer>
    </div>
  );
}
