// src/components/ui/landing/flow-showcase.tsx
// Step-by-step walkthroughs of the employer and candidate journeys, each step shown with a real screen.
import { useEffect, useState } from 'react';
import { Building2, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FlowStep {
  title: string;
  body: string;
  image: string;
  /** What the browser frame's address label says, e.g. "Employer · AI Dashboard". */
  screen: string;
}

export const EMPLOYER_STEPS: FlowStep[] = [
  { title: 'Start from your AI dashboard', body: 'See your interviews, running sessions and results in one place, and jump straight into a new interview.', image: '/landing/emp-1-dashboard.jpg', screen: 'Employer · AI Dashboard' },
  { title: 'Create an interview in minutes', body: 'Paste a job description or pick a template and the AI drafts the questions and scoring criteria. Prefer full control? Build it by hand.', image: '/landing/emp-2-create.jpg', screen: 'Employer · New Interview' },
  { title: 'Review and shape the questions', body: 'Reorder, edit or add questions, including live coding tasks. The interviewer asks them in order and probes with follow-ups.', image: '/landing/emp-3-questions.jpg', screen: 'Employer · Questions' },
  { title: 'Set skills, level and ground rules', body: 'List the skills you need, the experience level, the time limit, voice or chat, and anti-cheating monitoring. Skills decide which candidates see your interview.', image: '/landing/emp-4-settings.jpg', screen: 'Employer · Settings' },
  { title: 'Publish and invite', body: 'Publishing lists the interview for matching candidates automatically. Invite people by email or copy a personal link, and watch each person move from not started to completed.', image: '/landing/emp-5-invite.jpg', screen: 'Employer · Candidates' },
  { title: 'Follow every session', body: 'A live list of sessions with status and scores, so you always know who has finished and who is in progress.', image: '/landing/emp-6-results.jpg', screen: 'Employer · Interview Results' },
  { title: 'Read the scored report', body: 'The moment an interview ends you get a summary, a score for every question and criterion, strengths, improvements and the full transcript.', image: '/landing/emp-7-report.jpg', screen: 'Employer · Session Report' },
];

export const CANDIDATE_STEPS: FlowStep[] = [
  { title: 'Find interviews that match your skills', body: 'Open Interviews lists published interviews ranked by how well they fit your skills. New ones appear on their own.', image: '/landing/cand-1-matches.jpg', screen: 'Candidate · Open Interviews' },
  { title: 'Know exactly what to expect', body: 'See the required skills, experience level, duration, interview type and instructions before you decide to start.', image: '/landing/cand-2-details.jpg', screen: 'Candidate · Interview Details' },
  { title: 'Join with your email', body: 'Enter your email, read the short briefing and agree to the interview rules. Each email address can take an interview once.', image: '/landing/cand-3-briefing.jpg', screen: 'Candidate · Briefing' },
  { title: 'Run a quick device check', body: 'Check your camera, microphone and screen sharing in a minute. Anything you cannot share can be skipped.', image: '/landing/cand-4-checklist.jpg', screen: 'Candidate · Checklist' },
  { title: 'Talk to Humiq Loop AI', body: 'Have a natural voice conversation, follow the live transcript, and write code in the built-in editor when a question needs it.', image: '/landing/cand-5-voice.jpg', screen: 'Candidate · Interview Room' },
];

function BrowserFrame({ src, alt, label }: { src: string; alt: string; label: string }) {
  return (
    <figure className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border-b border-gray-200">
        <span className="flex gap-1.5" aria-hidden><i className="h-2.5 w-2.5 rounded-full bg-red-400" /><i className="h-2.5 w-2.5 rounded-full bg-amber-400" /><i className="h-2.5 w-2.5 rounded-full bg-green" /></span>
        <figcaption className="mx-auto rounded-md bg-white px-4 py-0.5 text-[11px] font-medium text-gray-500 truncate">{label}</figcaption>
        <span className="w-10" aria-hidden />
      </div>
      <img src={src} alt={alt} width={1440} height={900} loading="lazy" decoding="async" className="block w-full h-auto bg-gray-50" />
    </figure>
  );
}

function Steps({ steps, accent }: { steps: FlowStep[]; accent: 'navy' | 'green' }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const flip = i % 2 === 1;
        return (
          <li key={s.title} className="relative grid lg:grid-cols-12 gap-6 lg:gap-10 items-center pb-14 last:pb-0">
            <div className={cn('lg:col-span-5', flip && 'lg:order-2 lg:col-start-8')}>
              <div className="flex items-center gap-3 mb-3">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-full text-white font-display font-extrabold text-lg shadow-md', accent === 'navy' ? 'bg-navy' : 'bg-green')}>{i + 1}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Step {i + 1} of {steps.length}</span>
              </div>
              <h3 className="font-display text-2xl font-extrabold text-navy leading-snug">{s.title}</h3>
              <p className="mt-3 text-gray-600 leading-relaxed">{s.body}</p>
            </div>
            <div className={cn('lg:col-span-7', flip && 'lg:order-1')}>
              <BrowserFrame src={s.image} alt={`${s.screen}: ${s.title}`} label={s.screen} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type Tab = 'employers' | 'candidates';

const tabFromHash = (): Tab | null => {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.replace('#', '');
  return h === 'employers' || h === 'candidates' ? h : null;
};

export function FlowShowcase() {
  const [tab, setTab] = useState<Tab>(() => tabFromHash() ?? 'employers');

  // Menu links like /#candidates switch the tab as well as scrolling to the section.
  useEffect(() => {
    const onHash = () => { const t = tabFromHash(); if (t) setTab(t); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const steps = tab === 'employers' ? EMPLOYER_STEPS : CANDIDATE_STEPS;
  const overview = steps.map((s) => s.title);

  return (
    <section id="how" className="scroll-mt-20 py-20 px-5 sm:px-8 bg-gray-50">
      <span id="employers" className="scroll-mt-24 block" />
      <span id="candidates" className="scroll-mt-24 block" />
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-navy">See exactly how it works</h2>
          <p className="mt-3 text-gray-500">Follow each journey step by step, with the real screens you will use.</p>
        </div>

        <div role="tablist" aria-label="Choose a journey" className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full bg-white p-1.5 shadow-card border border-gray-100">
            {([['employers', 'For Employers', Building2], ['candidates', 'For Candidates', UserRound]] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={cn('flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-colors cursor-pointer', tab === key ? 'bg-navy text-white shadow' : 'text-gray-500 hover:text-navy')}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* The whole sequence at a glance */}
        <div className="mt-8 flex flex-wrap justify-center items-center gap-x-2 gap-y-2" aria-label="Sequence overview">
          {overview.map((t, i) => (
            <span key={t} className="flex items-center gap-2">
              <span className="rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600"><b className={tab === 'employers' ? 'text-navy' : 'text-green-dk'}>{i + 1}</b> {t}</span>
              {i < overview.length - 1 && <span className="text-gray-300" aria-hidden>→</span>}
            </span>
          ))}
        </div>

        <div className="mt-14" role="tabpanel">
          <Steps steps={steps} accent={tab === 'employers' ? 'navy' : 'green'} />
        </div>
        <p className="mt-10 text-center text-xs text-gray-400">Screens show sample data: a fictional company, role and candidates.</p>
      </div>
    </section>
  );
}
