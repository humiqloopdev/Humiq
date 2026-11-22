// src/components/ui/ai-interviews/interviewer-avatar.tsx
// Friendly cartoon interviewer wearing a headset. The mouth and sound rings animate while it asks a question;
// the mic badge pulses while the candidate's turn is live.
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AvatarState = 'speaking' | 'listening' | 'thinking' | 'idle';

const CSS = `
.av *{transform-box:fill-box;transform-origin:center}
.av-bob{animation:av-bob 3s ease-in-out infinite}
.av-blink{animation:av-blink 4.5s infinite}
.av-talk{animation:av-talk .32s ease-in-out infinite}
.av-ring{animation:av-ring 1.6s ease-out infinite}
.av-ring2{animation:av-ring 1.6s ease-out .8s infinite}
.av-pulse{animation:av-pulse 1.2s ease-in-out infinite}
.av-bar{animation:av-talk .55s ease-in-out infinite}
@keyframes av-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes av-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes av-talk{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@keyframes av-ring{0%{opacity:.55;transform:scale(.85)}100%{opacity:0;transform:scale(1.35)}}
@keyframes av-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
@media (prefers-reduced-motion:reduce){.av *{animation:none!important}}
`;

export function InterviewerAvatar({ state, size = 'clamp(110px, 26vh, 220px)' }: { state: AvatarState; size?: number | string }) {
  const speaking = state === 'speaking';
  const listening = state === 'listening';
  return (
    <div className="av relative inline-block" style={{ width: size, height: size }} role="img"
      aria-label={speaking ? 'Interviewer is speaking' : listening ? 'Interviewer is listening' : 'Interviewer'}>
      <style>{CSS}</style>
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        <circle cx="100" cy="100" r="92" fill="#EAF7F1" />
        {speaking && (
          <>
            <circle className="av-ring" cx="100" cy="100" r="84" fill="none" stroke="#1D9E75" strokeWidth="3" />
            <circle className="av-ring2" cx="100" cy="100" r="84" fill="none" stroke="#1D9E75" strokeWidth="3" />
          </>
        )}
        <g className="av-bob">
          <path d="M28 190c4-34 30-52 72-52s68 18 72 52z" fill="#1A3A5C" />
          <path d="M84 140l16 22 16-22z" fill="#fff" />
          <path d="M92 150l8 12 8-12-8-4z" fill="#1D9E75" />
          <rect x="88" y="118" width="24" height="26" rx="10" fill="#E9B48E" />
          <ellipse cx="57" cy="94" rx="7" ry="11" fill="#F2C3A0" />
          <ellipse cx="143" cy="94" rx="7" ry="11" fill="#F2C3A0" />
          <rect x="56" y="48" width="88" height="86" rx="42" fill="#F7CFAF" />
          <path d="M54 88c-6-38 18-56 48-56s52 16 46 56c-6-18-18-28-46-28S60 70 54 88z" fill="#2B2F3A" />
          <g className="av-blink">
            <ellipse cx="82" cy="95" rx="5" ry="6" fill="#23283A" />
            <ellipse cx="118" cy="95" rx="5" ry="6" fill="#23283A" />
          </g>
          <circle cx="84" cy="93" r="1.6" fill="#fff" />
          <circle cx="120" cy="93" r="1.6" fill="#fff" />
          <path d="M73 82q9-6 18 0M109 82q9-6 18 0" fill="none" stroke="#2B2F3A" strokeWidth="3" strokeLinecap="round" />
          <circle cx="72" cy="109" r="6" fill="#F4A58A" opacity=".5" />
          <circle cx="128" cy="109" r="6" fill="#F4A58A" opacity=".5" />
          {speaking
            ? <ellipse className="av-talk" cx="100" cy="116" rx="9" ry="7" fill="#8A2F3C" />
            : <path d="M89 113q11 9 22 0" fill="none" stroke="#8A2F3C" strokeWidth="3.5" strokeLinecap="round" />}
          <path d="M55 92c-4-46 26-62 45-62s49 16 45 62" fill="none" stroke="#0F6E56" strokeWidth="6" strokeLinecap="round" />
          <rect x="47" y="86" width="12" height="26" rx="6" fill="#0F6E56" />
          <rect x="141" y="86" width="12" height="26" rx="6" fill="#0F6E56" />
          <path d="M147 110c0 18-14 22-34 20" fill="none" stroke="#0F6E56" strokeWidth="4" strokeLinecap="round" />
          <rect x="102" y="124" width="14" height="10" rx="5" fill="#1D9E75" />
        </g>
      </svg>
      <span className={cn(
        'absolute bottom-3 right-3 h-11 w-11 rounded-full flex items-center justify-center shadow-md border-2 border-white',
        listening ? 'bg-green text-white av-pulse' : speaking ? 'bg-navy text-white' : 'bg-gray-200 text-gray-500',
      )}>
        {speaking ? <Volume2 size={20} /> : listening ? <Mic size={20} /> : <MicOff size={20} />}
      </span>
    </div>
  );
}
