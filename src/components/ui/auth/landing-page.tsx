// src/components/ui/auth/landing-page.tsx
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight, BarChart3, Check, Code2, FileText, Mail, Mic, ShieldCheck, Sparkles, Target, Users,
} from 'lucide-react';
import { Btn } from '@/components/ui/common';
import { PublicNav } from '@/components/ui/layout';
import { HeroBackground } from '@/components/ui/landing/hero-background';
import { IntroPlayer } from '@/components/ui/landing/intro-player';
import { FlowShowcase } from '@/components/ui/landing/flow-showcase';

const TRACKS = [
  {
    title: 'Technical interviews',
    tone: 'bg-navy text-white',
    points: ['Live coding with a built-in editor and starter code', 'Architecture and problem-solving conversations', 'Follow-up questions that dig into real depth', 'Scored against the skills you list'],
    icon: <Code2 size={22} />,
  },
  {
    title: 'Non-technical interviews',
    tone: 'bg-green text-white',
    points: ['Behavioural and situational questions', 'Communication, judgement and culture signals', 'Sales, support, operations and management roles', 'Natural voice or text conversation'],
    icon: <Users size={22} />,
  },
];

const FEATURES = [
  { icon: <Sparkles size={22} />, title: 'AI-drafted interviews', desc: 'Turn a job description into questions and scoring criteria in minutes.' },
  { icon: <Mic size={22} />, title: 'Voice, chat and code', desc: 'Candidates talk, type or write code, whichever suits the question.' },
  { icon: <Target size={22} />, title: 'Skill matching', desc: 'Published interviews reach candidates whose skills fit the role.' },
  { icon: <Mail size={22} />, title: 'Invite by email or link', desc: 'Send a personal link by email and track every candidate.' },
  { icon: <ShieldCheck size={22} />, title: 'Fair and monitored', desc: 'One attempt per email, plus tab-switch and paste monitoring.' },
  { icon: <FileText size={22} />, title: 'Live transcript', desc: 'Every word is captured as the conversation happens.' },
  { icon: <BarChart3 size={22} />, title: 'Scored reports', desc: 'A summary, per-question scores and strengths, ready after each interview.' },
  { icon: <Check size={22} />, title: 'Simple hiring flow', desc: 'From a job description to a ranked shortlist in one workspace.' },
];

const PLANS = [
  { name: 'Starter', price: '$299', per: '/mo', feats: ['3 active roles', 'Basic candidate pool', 'AI search', '90-day history'] },
  { name: 'Pro', price: '$699', per: '/mo', feats: ['10 active roles', 'Full candidate pool', 'Advanced analytics', 'API access'], featured: true },
  { name: 'Enterprise', price: 'Custom', per: '', feats: ['Unlimited roles', 'Dedicated support', 'SSO + custom config', 'Contract pricing'] },
];

const FAQ = [
  { q: 'Can it interview for non-technical roles?', a: 'Yes. Questions can be behavioural, situational or role-specific, and the AI interviewer adapts its follow-ups to the answers it hears.' },
  { q: 'What does a candidate need?', a: 'A recent version of Chrome. For voice interviews they also need a microphone; text chat works without one.' },
  { q: 'Can someone take the same interview twice?', a: 'No. Each email address can take a given interview once, and the same email can still take other interviews.' },
  { q: 'When do I get the report?', a: 'Right after the interview ends, with a summary, scores for each question and criterion, and the full transcript.' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const hireWithAi = () => navigate({ to: '/signup', search: { role: 'employer' } });
  const takeInterview = () => navigate({ to: '/signup', search: { role: 'candidate' } });

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <div className="pt-16">
        {/* Hero: headline, then the intro player */}
        <section className="relative overflow-hidden bg-navy text-white px-5 sm:px-8 py-6 min-h-[calc(100vh-4rem)] flex items-center">
          <HeroBackground />
          <div className="relative w-full max-w-5xl mx-auto text-center">
            <p className="inline-flex items-center gap-2 text-green-lt text-sm font-semibold px-4 py-1.5 bg-white/10 rounded-full">
              <Sparkles size={14} /> AI interviews for every role
            </p>
            <h1 className="mt-[2.5vh] font-display font-extrabold leading-[1.08] text-[clamp(1.75rem,min(7vw,8.5vh),3.75rem)]">
              Let an AI interviewer<br /><span className="text-green">meet every candidate.</span>
            </h1>
            <div className="mt-[3vh]"><IntroPlayer /></div>
            <div className="mt-[3vh] flex gap-3 sm:gap-4 justify-center flex-wrap">
              <Btn v="primary" sz="xl" onClick={hireWithAi}>Start hiring with AI <ArrowRight size={18} /></Btn>
              <Btn v="outline" sz="xl" className="!border-white/60 !text-white !bg-white/10 hover:!bg-white hover:!text-navy" onClick={takeInterview}>Take an interview</Btn>
            </div>
          </div>
        </section>

        {/* Technical and non-technical */}
        <section className="py-20 px-5 sm:px-8 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-navy">One Platform for all your interviews</h2>
              <p className="mt-3 text-gray-500">Pick the format that fits the role. The setup, scoring and reports work the same way.</p>
            </div>
            <div className="mt-10 grid md:grid-cols-2 gap-6">
              {TRACKS.map((t) => (
                <div key={t.title} className="rounded-3xl border border-gray-100 shadow-card overflow-hidden bg-white">
                  <div className={`flex items-center gap-3 px-6 py-5 ${t.tone}`}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">{t.icon}</span>
                    <h3 className="font-display text-xl font-extrabold">{t.title}</h3>
                  </div>
                  <ul className="p-6 space-y-3">
                    {t.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-gray-600"><Check size={18} className="mt-0.5 shrink-0 text-green" /> {p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <FlowShowcase />

        {/* Reports */}
        <section className="py-20 px-5 sm:px-8 bg-navy text-white">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-green font-bold text-sm uppercase tracking-wider">Reports</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold leading-tight">A scored report the moment the interview ends</h2>
              <p className="mt-4 text-white/70 leading-relaxed">No more notes to write up. Each interview is summarised and scored against the criteria you chose, so you can compare people on the same footing.</p>
              <ul className="mt-6 space-y-3">
                {['Overall score and a plain-language summary', 'A score and written evaluation for every question', 'Strengths and areas to improve, per answer', 'Full transcript, submitted code and monitoring log'].map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-white/85"><Check size={18} className="mt-0.5 shrink-0 text-green" /> {p}</li>
                ))}
              </ul>
            </div>
            <figure className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-white">
              <img src="/landing/emp-7-report.jpg" alt="A session report with an overall score, summary and question-by-question evaluation" width={1440} height={900} loading="lazy" decoding="async" className="block w-full h-auto" />
            </figure>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-5 sm:px-8 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-center font-display text-3xl sm:text-4xl font-extrabold text-navy">Everything in one workspace</h2>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl bg-white p-6 shadow-card border border-gray-100">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-xlt text-green-dk">{f.icon}</span>
                  <h3 className="mt-4 font-display font-bold text-navy text-lg">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 py-20 px-5 sm:px-8 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-navy">Simple plans for employers</h2>
              <p className="mt-3 text-gray-500">Candidates always use Humiq Loop for free. Employers start with a 14-day free trial.</p>
            </div>
            <div className="mt-10 grid md:grid-cols-3 gap-6">
              {PLANS.map((p) => (
                <div key={p.name} className={`rounded-3xl p-7 border ${p.featured ? 'border-green shadow-xl ring-2 ring-green/20 bg-white' : 'border-gray-100 shadow-card bg-white'}`}>
                  {p.featured
                    ? <span className="inline-block mb-3 rounded-full bg-green text-white text-xs font-bold px-3 py-1">Most popular</span>
                    : <span className="block mb-3 h-[26px]" aria-hidden />}
                  <h3 className="font-display text-xl font-extrabold text-navy">{p.name}</h3>
                  <div className="mt-2"><span className="font-display text-4xl font-extrabold text-navy">{p.price}</span><span className="text-gray-400">{p.per}</span></div>
                  <ul className="mt-5 space-y-2.5">
                    {p.feats.map((f) => <li key={f} className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} className="text-green shrink-0" /> {f}</li>)}
                  </ul>
                  <div className="mt-6"><Btn v={p.featured ? 'primary' : 'outline'} block onClick={hireWithAi}>Start free trial</Btn></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-5 sm:px-8 bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-center font-display text-3xl sm:text-4xl font-extrabold text-navy">Questions, answered</h2>
            <div className="mt-8 space-y-3">
              {FAQ.map((f) => (
                <details key={f.q} className="group rounded-2xl bg-white border border-gray-100 shadow-card px-6 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-navy">
                    {f.q}<span className="text-green text-xl leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 text-gray-600 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="px-5 sm:px-8 py-20 bg-gradient-to-br from-navy to-green-dk text-white text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold">Ready to meet your AI interviewer?</h2>
          <p className="mt-3 text-white/75 max-w-xl mx-auto">Set up your first interview in minutes, or find one that matches your skills.</p>
          <div className="mt-8 flex gap-3 justify-center flex-wrap">
            <Btn v="primary" sz="xl" onClick={hireWithAi}>Start hiring with AI <ArrowRight size={18} /></Btn>
            <Btn v="outline" sz="xl" className="!border-white/60 !text-white !bg-white/10 hover:!bg-white hover:!text-navy" onClick={takeInterview}>Take an interview</Btn>
          </div>
        </section>

        <footer className="px-5 sm:px-8 py-8 bg-navy-dk text-white/60 text-sm">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-lg bg-white px-3 py-1.5"><img src="/logo.png" alt="Humiq Loop - AI Interview Platform" className="h-8 w-auto" /></span>
            <span>© {new Date().getFullYear()} Humiq Loop. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
