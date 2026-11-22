// src/components/ui/landing/intro-player.tsx
// "Meet Humiq Loop AI": press play and the avatar introduces itself out loud (browser speech synthesis) with live captions.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Square, Volume2, VolumeX } from 'lucide-react';
import { InterviewerAvatar } from '@/components/ui/ai-interviews/interviewer-avatar';
import { cn } from '@/lib/utils';
import { HeroFlow } from './hero-flow';

export const INTRO_TEXT =
  'Hello, I am Humiq Loop AI. I can take interviews for technical and non-technical roles. ' +
  'I can act as a real-time interviewer, take the interview live, and provide real-time reports. Thank you.';

type Phase = 'idle' | 'speaking' | 'done';

// Used when the browser reports no word boundaries: roughly how fast the voice speaks, in characters per second.
const FALLBACK_CHARS_PER_SECOND = 14;

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  return english.find((v) => /natural|aria|jenny|google us|samantha|zira/i.test(v.name)) ?? english[0];
}

/** Drives the speech and reports how far through the text it is (a character index), so captions can follow along. */
export function useSpeechIntro(text: string) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [charIndex, setCharIndex] = useState(0);
  const supported = canSpeak();
  const timer = useRef<number | null>(null);
  const run = useRef(0); // guards against events from a previous run firing after stop/replay

  const clearTimer = () => { if (timer.current !== null) { window.clearInterval(timer.current); timer.current = null; } };

  const stop = useCallback(() => {
    run.current++;
    clearTimer();
    if (canSpeak()) window.speechSynthesis.cancel();
    setPhase('idle');
    setCharIndex(0);
  }, []);

  const play = useCallback(() => {
    const id = ++run.current;
    clearTimer();
    setCharIndex(0);
    setPhase('speaking');

    const finish = () => { if (run.current !== id) return; clearTimer(); setCharIndex(text.length); setPhase('done'); };

    // Estimated progress keeps the captions moving even when the voice does not send word-boundary events.
    const startedAt = Date.now();
    let sawBoundary = false;
    timer.current = window.setInterval(() => {
      if (run.current !== id || sawBoundary) return;
      const est = Math.floor(((Date.now() - startedAt) / 1000) * FALLBACK_CHARS_PER_SECOND);
      if (est >= text.length) finish(); else setCharIndex(est);
    }, 120);

    if (!canSpeak()) return; // captions-only mode: the timer above finishes the run

    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
      u.rate = 1;
      u.pitch = 1.05;
      u.onboundary = (e) => { if (run.current === id && typeof e.charIndex === 'number') { sawBoundary = true; setCharIndex(e.charIndex); } };
      // A browser with no usable voice can "finish" instantly without any sound; keep the captions running on the timer instead.
      u.onend = () => { if (Date.now() - startedAt < Math.min(3000, (text.length / FALLBACK_CHARS_PER_SECOND) * 300)) return; finish(); };
      u.onerror = (e) => { if ((e as SpeechSynthesisErrorEvent).error === 'canceled' || (e as SpeechSynthesisErrorEvent).error === 'interrupted') return; finish(); };
      window.speechSynthesis.speak(u);
    } catch {
      /* captions keep running on the timer */
    }
  }, [text]);

  useEffect(() => () => { run.current++; clearTimer(); if (canSpeak()) window.speechSynthesis.cancel(); }, []);

  return { phase, charIndex, play, stop, supported };
}

/** The text split so the part already spoken is emphasised. */
function Captions({ text, charIndex, phase }: { text: string; charIndex: number; phase: Phase }) {
  const at = phase === 'idle' ? 0 : phase === 'done' ? text.length : charIndex;
  return (
    <p className="text-sm sm:text-base leading-relaxed text-left" aria-live="polite">
      <span className="text-white">{text.slice(0, at)}</span>
      <span className="text-white/45">{text.slice(at)}</span>
    </p>
  );
}

/** How long the finished introduction stays on screen before the hero returns to its starting view. */
const RETURN_DELAY_MS = 1200;

export function IntroPlayer({ text = INTRO_TEXT }: { text?: string }) {
  const { phase, charIndex, play, stop, supported } = useSpeechIntro(text);
  const speaking = phase === 'speaking';

  // After the introduction has finished, go back to the first view (just the Play button).
  useEffect(() => {
    if (phase !== 'done') return;
    const t = window.setTimeout(stop, RETURN_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [phase, stop]);

  // The area keeps the same height in both views so the hero does not jump when the card appears.
  return (
    <div className="mx-auto flex w-full max-w-3xl items-center justify-center min-h-[11rem]" data-testid="intro-player">
      {phase === 'idle' ? (
        <div className="flex w-full flex-col items-center justify-center gap-4 [@media(max-height:680px)]:gap-2">
          <HeroFlow />
          <button type="button" onClick={play} aria-label="Play introduction"
            className="relative flex items-center gap-3 rounded-full bg-green text-white font-bold px-7 py-3 [@media(max-height:680px)]:py-2 text-base cursor-pointer hover:bg-green-md transition-colors shadow-xl shadow-green/30">
            <span className="absolute inset-0 rounded-full bg-green/40 animate-ping" aria-hidden />
            <Play size={18} fill="currentColor" className="relative" />
            <span className="relative">AI Platform</span>
          </button>
          {!supported && <span className="text-xs text-white/60">Your browser cannot play speech, so the introduction is shown as captions.</span>}
        </div>
      ) : (
        <div className="w-full rounded-3xl border border-white/15 bg-white/10 backdrop-blur p-4 sm:p-5 text-white shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-7">
            <div className="relative shrink-0">
              <InterviewerAvatar state={speaking ? 'speaking' : 'idle'} size={104} />
            </div>
            <div className="flex-1 min-w-0 w-full">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-green-lt">Meet your AI interviewer</div>
                  <div className="font-display text-xl font-extrabold">Humiq Loop AI</div>
                </div>
                <span className={cn('flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1', speaking ? 'bg-green/25 text-green-lt' : 'bg-white/10 text-white/70')}>
                  {supported ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  {speaking ? 'Speaking…' : 'Finished'}
                </span>
              </div>
              <Captions text={text} charIndex={charIndex} phase={phase} />
              {speaking && (
                <div className="mt-3">
                  <button type="button" onClick={stop} className="flex items-center gap-2 rounded-full bg-white text-navy font-bold px-5 py-2.5 text-sm cursor-pointer hover:bg-gray-100 transition-colors">
                    <Square size={15} fill="currentColor" /> Stop
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
