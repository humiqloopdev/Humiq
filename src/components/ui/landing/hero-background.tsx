// src/components/ui/landing/hero-background.tsx
// Decorative animated backdrop for the landing hero: deep-blue "digital" scene with drifting glows, falling data
// streams, a pulsing circuit line and softly floating interview cards. Pure CSS/SVG, so it stays light and sharp.
import type { CSSProperties } from 'react';

const STREAMS = Array.from({ length: 16 }, (_, i) => ({
  left: `${3 + i * 6.1}%`,
  delay: `${(i * 1.7) % 9}s`,
  duration: `${9 + ((i * 3) % 7)}s`,
  text: ['0 1 1 0 1 0 0 1 1', '1 0 1 1 0 0 1 0 1', '0 0 1 0 1 1 0 1 0'][i % 3].split(' ').join('\n'),
}));

const GLOWS = [
  { left: '8%', top: '22%', size: 10, delay: '0s' }, { left: '92%', top: '30%', size: 12, delay: '1.2s' },
  { left: '18%', top: '72%', size: 8, delay: '2.1s' }, { left: '84%', top: '78%', size: 10, delay: '0.6s' },
  { left: '50%', top: '10%', size: 6, delay: '1.8s' }, { left: '34%', top: '88%', size: 7, delay: '2.8s' },
];

const CSS = `
@keyframes hb-fall { from { transform: translateY(-30%); opacity: 0 } 15% { opacity: .55 } 85% { opacity: .55 } to { transform: translateY(110vh); opacity: 0 } }
@keyframes hb-float { 0%,100% { transform: translateY(0) rotate(var(--r)) } 50% { transform: translateY(-14px) rotate(var(--r)) } }
@keyframes hb-pulse { 0%,100% { opacity: .25; transform: scale(1) } 50% { opacity: 1; transform: scale(1.8) } }
@keyframes hb-drift { 0%,100% { transform: translate(0,0) } 50% { transform: translate(40px,-24px) } }
@keyframes hb-wave { 0%,100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }
@keyframes hb-dash { to { stroke-dashoffset: -240 } }
@media (prefers-reduced-motion: reduce) { .hb-anim, .hb-anim * { animation: none !important } }
`;

function ResumeCard({ className, style, tone }: { className?: string; style?: CSSProperties; tone: 'light' | 'green' }) {
  const line = tone === 'green' ? 'bg-emerald-300/70' : 'bg-sky-300/70';
  return (
    <div className={`hb-anim absolute w-44 rounded-xl border border-white/20 bg-white/10 p-3 shadow-xl backdrop-blur-sm ${className ?? ''}`} style={{ animation: 'hb-float 7s ease-in-out infinite', ...style }}>
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-full bg-white/30" />
        <span className={`h-1.5 flex-1 rounded ${line}`} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-2.5 flex items-center gap-2">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-emerald-400/80 text-[9px] leading-none text-white">✓</span>
          <span className="h-1.5 rounded bg-white/35" style={{ width: `${82 - i * 16}%` }} />
        </div>
      ))}
    </div>
  );
}

/** The animated scene is on by default; `active={false}` fades it out and leaves only the plain blue-to-teal gradient. */
export function HeroBackground({ active = true }: { active?: boolean }) {
  return (
    <div className="hb-anim pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-testid="hero-background" data-active={active}>
      <style>{CSS}</style>

      {/* plain gradient underneath (what shows if the scene is switched off) */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy to-green-dk" />

      <div className={`absolute inset-0 transition-opacity duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
      {/* base: deep blue with a teal glow bottom-right, like a screen-lit room */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0a1d5e_0%,#123a94_45%,#0d5d9c_75%,#0f8a8f_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(56,189,248,.28),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:56px_56px]" />

      {/* drifting colour glows */}
      <div className="absolute -left-24 top-10 h-96 w-96 rounded-full bg-cyan-400/25 blur-3xl" style={{ animation: 'hb-drift 14s ease-in-out infinite' }} />
      <div className="absolute -right-24 bottom-0 h-[26rem] w-[26rem] rounded-full bg-emerald-400/25 blur-3xl" style={{ animation: 'hb-drift 17s ease-in-out infinite reverse' }} />

      {/* falling data streams */}
      {STREAMS.map((s, i) => (
        <pre key={i} className="absolute top-0 font-mono text-[11px] leading-4 text-sky-200/60 whitespace-pre" style={{ left: s.left, animation: `hb-fall ${s.duration} linear ${s.delay} infinite` }}>{s.text}</pre>
      ))}

      {/* twinkling light points */}
      {GLOWS.map((g, i) => (
        <span key={i} className="absolute rounded-full bg-cyan-200 shadow-[0_0_14px_4px_rgba(103,232,249,.7)]" style={{ left: g.left, top: g.top, width: g.size, height: g.size, animation: `hb-pulse 3.4s ease-in-out ${g.delay} infinite` }} />
      ))}

      {/* floating interview cards at the sides (extra-wide screens only, so they never sit behind the content) */}
      <div className="hidden 2xl:block">
        <ResumeCard tone="light" className="left-[3%] top-[18%]" style={{ ['--r' as string]: '-4deg' }} />
        <ResumeCard tone="green" className="left-[7%] top-[56%]" style={{ ['--r' as string]: '3deg', animationDelay: '1.4s' }} />
        <ResumeCard tone="green" className="right-[3%] top-[16%]" style={{ ['--r' as string]: '4deg', animationDelay: '.7s' }} />
        {/* score card */}
        <div className="absolute right-[6%] top-[52%] w-48 rounded-xl border border-white/20 bg-navy/60 p-3.5 text-white shadow-xl backdrop-blur-sm" style={{ ['--r' as string]: '-3deg', animation: 'hb-float 8s ease-in-out 1s infinite' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-200">AI analysis</div>
          <div className="mt-1 text-sm font-semibold">Score: <span className="text-amber-300">8.5</span></div>
          <div className="mt-2 flex h-8 items-end gap-1">
            {[40, 70, 50, 90, 65, 80].map((h, i) => (
              <span key={i} className="w-3 origin-bottom rounded-sm bg-gradient-to-t from-cyan-400 to-emerald-300" style={{ height: `${h}%`, animation: `hb-wave 2.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
        {/* voice bubble */}
        <div className="absolute left-[24%] top-[8%] flex h-10 w-28 items-center justify-center gap-[3px] rounded-2xl rounded-bl-sm border border-white/20 bg-white/15 backdrop-blur-sm">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="h-6 w-[3px] origin-center rounded bg-cyan-200" style={{ animation: `hb-wave ${1 + (i % 4) * 0.25}s ease-in-out ${i * 0.07}s infinite` }} />
          ))}
        </div>
      </div>

      {/* circuit line along the bottom, with travelling light */}
      <svg className="absolute bottom-3 left-0 h-16 w-full opacity-70" viewBox="0 0 1200 64" preserveAspectRatio="none">
        <path d="M0 40 H220 L250 18 H520 L545 44 H800 L830 22 H1200" fill="none" stroke="rgba(125,211,252,.35)" strokeWidth="1.5" />
        <path d="M0 40 H220 L250 18 H520 L545 44 H800 L830 22 H1200" fill="none" stroke="#67e8f9" strokeWidth="2" strokeDasharray="40 200" style={{ animation: 'hb-dash 4s linear infinite' }} />
        {[250, 520, 830].map((x, i) => <circle key={x} cx={x} cy={[18, 44, 22][i]} r="4" fill="#fbbf24" style={{ animation: `hb-pulse 3s ease-in-out ${i * 0.8}s infinite`, transformBox: 'fill-box', transformOrigin: 'center' }} />)}
      </svg>

      {/* 60% dark layer over the background (content sits above it and is unchanged) */}
      <div className="absolute inset-0 bg-[#020617]/60" />

      {/* keeps text readable: soft vignette toward the middle */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(8,20,70,.35),transparent_65%)]" />
      </div>
    </div>
  );
}
