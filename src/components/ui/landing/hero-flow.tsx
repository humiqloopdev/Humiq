// src/components/ui/landing/hero-flow.tsx
// The animated four-step strip shown in the hero: roles -> AI interviewer -> live interview -> real-time reports.
// Pure CSS animation: the steps light up one after another and a dot travels along each dotted arrow.
import { BarChart3, Bot, Briefcase, Check, MonitorPlay } from 'lucide-react';
import type { ReactNode } from 'react';

const STEPS: { n: string; title: string; sub: string; icon: ReactNode }[] = [
  { n: '01', title: 'Technical & Non-Technical Roles', sub: 'Any role, any level', icon: <Briefcase size={34} strokeWidth={1.8} /> },
  { n: '02', title: 'AI Real-Time Interviewer', sub: 'Adaptive questions', icon: <Bot size={34} strokeWidth={1.8} /> },
  { n: '03', title: 'Live Interview', sub: 'Voice and video, live', icon: <MonitorPlay size={34} strokeWidth={1.8} /> },
  { n: '04', title: 'Real-Time Reports', sub: 'Instant scores & insights', icon: <BarChart3 size={34} strokeWidth={1.8} /> },
];

const CYCLE_S = 6.4; // the highlight visits each of the four steps once per cycle

const CSS = `
@keyframes hf-step { 0%,4% { transform: translateY(0) scale(1); box-shadow: 0 0 0 0 rgba(52,211,153,0) } 8%,22% { transform: translateY(-4px) scale(1.06); box-shadow: 0 0 26px 2px rgba(52,211,153,.55) } 28%,100% { transform: translateY(0) scale(1); box-shadow: 0 0 0 0 rgba(52,211,153,0) } }
@keyframes hf-flow { from { left: 0; opacity: 0 } 10% { opacity: 1 } 90% { opacity: 1 } to { left: calc(100% - 6px); opacity: 0 } }
@keyframes hf-live { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
@media (prefers-reduced-motion: reduce) { .hf-anim, .hf-anim * { animation: none !important } }
`;

export function HeroFlow() {
  return (
    <div className="hf-anim w-full rounded-3xl border border-white/15 bg-gradient-to-br from-navy/70 via-[#14507a]/70 to-green/60 px-3 py-5 [@media(max-height:680px)]:py-3 sm:px-6 shadow-2xl backdrop-blur-sm" data-testid="hero-flow">
      <style>{CSS}</style>
      <ol className="grid grid-cols-2 gap-x-2 gap-y-6 md:grid-cols-4 md:gap-y-0">
        {STEPS.map((s, i) => (
          <li key={s.n} className="relative flex flex-col items-center text-center px-1">
            <span className="text-xs font-bold tracking-widest text-emerald-300">{s.n}</span>
            <div className="relative mt-2 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-2xl border border-emerald-300/50 bg-gradient-to-br from-navy/80 to-green/40 text-white"
              style={{ animation: `hf-step ${CYCLE_S}s ease-in-out ${i * (CYCLE_S / 4)}s infinite` }}>
              {s.icon}
              {i === 2 && <span className="absolute -right-3 -top-2 rounded-md bg-emerald-400 px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-navy" style={{ animation: 'hf-live 1.4s ease-in-out infinite' }}>LIVE</span>}
              {i === 3 && <span className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-navy"><Check size={14} strokeWidth={3.5} /></span>}
            </div>
            <h3 className="mt-3 [@media(max-height:680px)]:mt-2 font-display text-sm sm:text-[0.95rem] font-extrabold leading-snug text-white">{s.title}</h3>
            <p className="mt-0.5 text-[11px] text-white/60 [@media(max-height:680px)]:hidden">{s.sub}</p>

            {i < STEPS.length - 1 && (
              <span className="pointer-events-none absolute left-[calc(50%+3rem)] top-[3.9rem] hidden h-0 w-[calc(100%-6rem)] border-t-2 border-dashed border-emerald-300/60 md:block" aria-hidden>
                <i className="absolute -top-[5px] h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_2px_rgba(110,231,183,.8)]" style={{ animation: `hf-flow 1.6s linear ${i * 0.4}s infinite` }} />
                <b className="absolute -right-0.5 -top-[7px] text-emerald-300 text-sm leading-none">›</b>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
