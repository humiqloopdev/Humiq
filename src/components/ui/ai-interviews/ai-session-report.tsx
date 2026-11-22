// src/components/ui/ai-interviews/ai-session-report.tsx
// Session detail: every value on this page comes from GET /employers/me/ai/sessions/:id (the database record
// for the session, its messages and the AI report stored in `insights`).
import { useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft, ChevronDown, Clock, FileDown, FileText, HelpCircle, Lightbulb, MessageCircle, Mic, ShieldAlert, Smile, Sparkles, Tags, Terminal, Volume2,
} from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, LoadingState } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { cn } from '@/lib/utils';
import type { BadgeVariant } from '@/types';
import { apiErrorMessage, useAiSession, useSummarizeSession } from '@/api/aiInterviews/useAiInterviews';
import { fmtDuration, overallScore, STATUS_BADGE } from './ai-bits';
import { CodeBlock } from './code-editor';

const scoreColor = (s: number) => (s >= 7 ? 'text-green' : s >= 5 ? 'text-amber' : 'text-red-600');
const scoreFill = (s: number) => (s >= 7 ? 'bg-green' : s >= 5 ? 'bg-amber' : 'bg-red-500');
const scoreStroke = (s: number) => (s >= 7 ? '#1D9E75' : s >= 5 ? '#B45309' : '#DC2626');

const TONE_BADGE: Record<string, BadgeVariant> = { confident: 'green', enthusiastic: 'green', neutral: 'gray', hesitant: 'amber', uncertain: 'amber' };
const CONFIDENCE_BADGE: Record<string, BadgeVariant> = { high: 'green', medium: 'gray', low: 'red' };
const SENTIMENT_BADGE: Record<string, BadgeVariant> = { positive: 'green', neutral: 'amber', negative: 'red' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The report is written by an LLM, so its shape varies between runs (a list one time, a single string the next,
// or missing). These keep the page from crashing on any of those.
const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const EMPTY_ITEM = /^(none|n\/a|na|nil|-)\.?$/i;
const asList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : [])
    .map((x) => (typeof x === 'string' ? x : x == null ? '' : String(x)).replace(/^\s*[-•*]\s*/, '').trim())
    .filter((x) => x && !EMPTY_ITEM.test(x));

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function Section({ icon, title, chip, aside, children, className }: { icon: ReactNode; title: string; chip?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('break-inside-avoid', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-display font-bold text-navy">
          <span className="text-gray-500">{icon}</span>{title}
          {chip && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{chip}</span>}
        </h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[72px] w-[72px]" role="img" aria-label={`Average score ${score.toFixed(1)} out of 10`}>
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#E5E7EB" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={scoreStroke(score)} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(10, score) / 10)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-navy">{score.toFixed(1)}</span>
    </div>
  );
}

export function AiSessionReport({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const { data: s, isLoading, error } = useAiSession(sessionId);
  const summarize = useSummarizeSession();
  const [err, setErr] = useState('');
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  if (isLoading) return <EmployerShell><LoadingState msg="Loading session…" /></EmployerShell>;
  if (error || !s) return <EmployerShell><Alert v="error">{apiErrorMessage(error, 'Session not found.')}</Alert></EmployerShell>;

  const name = s.participantName || s.participantEmail || 'Anonymous';
  const score = overallScore(s.insights);
  const insights = s.insights;
  const questionEvals = asArray<NonNullable<typeof insights>['questionEvaluations'] extends (infer T)[] | undefined ? T : never>(insights?.questionEvaluations);
  const criteriaEvals = asArray<NonNullable<NonNullable<typeof insights>['criteriaEvaluations']>[number]>(insights?.criteriaEvaluations);
  const tone = insights?.toneAnalysis;
  const toneSegments = asArray<NonNullable<NonNullable<typeof tone>['segments']>[number]>(tone?.segments);
  const research = asArray<NonNullable<NonNullable<typeof insights>['researchFindings']>[number]>(insights?.researchFindings);
  const quotes = asList(insights?.notableQuotes);
  const keyInsights = asList(insights?.keyInsights);
  const themes = asList(s.themes);
  const hasReport = !!s.summary;
  const all = s.messages.filter((m) => m.role !== 'SYSTEM');
  const transcript = all.filter((m) => m.contentType !== 'CODE');
  const snippets = all.filter((m) => m.contentType === 'CODE' && m.whiteboardData?.code?.trim());
  const violations = asArray<{ type: string; timestamp: number; detail?: string }>(s.antiCheatingLog);
  const status = STATUS_BADGE[s.status];

  // Export PDF: print the page with the app chrome hidden (see `body.printing-report` in index.css).
  const exportPdf = () => {
    document.body.classList.add('printing-report');
    const done = () => { document.body.classList.remove('printing-report'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };

  return (
    <EmployerShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Btn v="outline" sz="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate({ to: '/employer/ai/sessions' })}>Back to Results</Btn>
          <div className="flex items-center gap-2">
            <Btn v="outline" sz="sm" icon={<Sparkles size={14} />} loading={summarize.isPending} disabled={transcript.length === 0}
              onClick={() => { setErr(''); summarize.mutateAsync(sessionId).catch((e) => setErr(apiErrorMessage(e, 'Could not generate the report.'))); }}>
              {hasReport ? 'Regenerate report' : 'Generate AI report'}
            </Btn>
            <Btn v="outline" sz="sm" icon={<FileDown size={14} />} onClick={exportPdf}>Export PDF</Btn>
          </div>
        </div>
        {err && <Alert v="error">{err}</Alert>}

        <h1 className="text-xl sm:text-2xl font-display font-bold text-navy">{s.interviewTitle} — Session Report</h1>

        {/* Participant + average score */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Card>
            <div className="flex items-center gap-5">
              <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-navy-lt text-2xl font-bold text-navy" aria-hidden>{name.charAt(0).toUpperCase()}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-navy">{name}</span>
                  <Badge v={status?.v ?? 'gray'}>{status?.label ?? s.status}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1"><Clock size={13} />{new Date(s.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  <span>{s.totalDurationSeconds ? fmtDuration(s.totalDurationSeconds) : '—'}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={13} />{all.length} messages</span>
                  {s.participantEmail && s.participantName && <span className="truncate">{s.participantEmail}</span>}
                </div>
                {s.interviewObjective && <p className="mt-2 text-sm text-gray-600"><b className="text-gray-800">Objective:</b> {s.interviewObjective}</p>}
              </div>
            </div>
          </Card>
          <Card className="flex min-w-[150px] flex-col items-center justify-center gap-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Avg score</div>
            {score != null ? <ScoreRing score={score} /> : <div className="flex h-[72px] items-center text-2xl font-bold text-gray-400">—</div>}
            <div className="text-xs text-gray-500">out of 10</div>
          </Card>
        </div>

        {/* Summary */}
        <Section icon={<FileText size={18} />} title="Summary">
          {hasReport
            ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{s.summary}</p>
            : <p className="text-sm text-gray-500">No report yet. Use “Generate AI report” once the interview has a transcript.</p>}
        </Section>

        {/* Question-by-question */}
        {questionEvals.length > 0 && (
          <Section icon={<HelpCircle size={18} />} title="Question-by-Question Evaluation">
            <div className="space-y-4">
              {questionEvals.map((q, i) => {
                const text = q.evaluation ?? q.feedback ?? q.rationale;
                const strengths = asList(q.highlights);
                const improvements = asList(q.improvements);
                return (
                  <div key={i} className="break-inside-avoid rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-semibold text-navy">Q{i + 1}. {q.question ?? `Question ${i + 1}`}</p>
                      <span className={cn('flex-shrink-0 text-sm font-bold', scoreColor(q.score))}>{q.score}/10</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><div className={cn('h-2 rounded-full', scoreFill(q.score))} style={{ width: `${Math.min(100, Math.max(0, q.score * 10))}%` }} /></div>
                    {text && <p className="mt-3 text-sm text-gray-700">{text}</p>}
                    {(strengths.length || improvements.length) ? (
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <div>
                          <div className="text-xs font-bold text-green-dk">Strengths</div>
                          {strengths.length
                            ? <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-gray-600">{strengths.map((h, j) => <li key={j}>{h}</li>)}</ul>
                            : <p className="mt-1 text-xs text-gray-400">None noted.</p>}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-amber">Areas for Improvement</div>
                          {improvements.length
                            ? <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-gray-600">{improvements.map((h, j) => <li key={j}>{h}</li>)}</ul>
                            : <p className="mt-1 text-xs text-gray-400">None noted.</p>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {criteriaEvals.length > 0 && (
          <Section icon={<Sparkles size={18} />} title="Assessment Criteria">
            <div className="space-y-4">
              {criteriaEvals.map((c, i) => (
                <div key={i} className="break-inside-avoid rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-4"><p className="text-sm font-semibold text-navy">{c.name ?? c.criterion}</p><span className={cn('flex-shrink-0 text-sm font-bold', scoreColor(c.score))}>{c.score}/10</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><div className={cn('h-2 rounded-full', scoreFill(c.score))} style={{ width: `${Math.min(100, Math.max(0, c.score * 10))}%` }} /></div>
                  {(c.reasoning ?? c.rationale ?? c.evidence) && <p className="mt-3 text-sm text-gray-700">{c.reasoning ?? c.rationale ?? c.evidence}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Tone */}
        {tone && (tone.overall || tone.details || toneSegments.length > 0) && (
          <Section icon={<Volume2 size={18} />} title="Tone & Communication" aside={tone.overall ? <Badge v={TONE_BADGE[tone.overall.toLowerCase()] ?? 'gray'}>{cap(tone.overall)}</Badge> : undefined}>
            {tone.details && <p className="text-sm text-gray-700">{tone.details}</p>}
            {toneSegments.length ? (
              <div className="mt-4 space-y-2">
                {toneSegments.map((seg, i) => (
                  <div key={i} className="break-inside-avoid flex items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy">{seg.question}</p>
                      {seg.notes && <p className="mt-0.5 text-xs text-gray-600">{seg.notes}</p>}
                    </div>
                    <div className="flex flex-shrink-0 gap-1.5">
                      {seg.tone && <Badge v={TONE_BADGE[seg.tone.toLowerCase()] ?? 'gray'}>{cap(seg.tone)}</Badge>}
                      {seg.confidence && <Badge v={CONFIDENCE_BADGE[seg.confidence.toLowerCase()] ?? 'gray'}>{cap(seg.confidence)}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>
        )}

        {/* Insights / Themes / Sentiment */}
        {hasReport && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Section icon={<Lightbulb size={18} />} title="Key Insights">
              {keyInsights.length
                ? <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">{keyInsights.map((k, i) => <li key={i}>{k}</li>)}</ul>
                : <p className="text-sm text-gray-500">No insights recorded.</p>}
              {quotes.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Notable quotes</div>
                  <ul className="mt-1.5 space-y-1.5 text-sm italic text-gray-600">{quotes.map((qt, i) => <li key={i}>“{qt}”</li>)}</ul>
                </div>
              )}
            </Section>
            <Section icon={<Tags size={18} />} title="Themes">
              {themes.length ? <div className="flex flex-wrap gap-2">{themes.map((t) => <span key={t} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700">{t}</span>)}</div> : <p className="text-sm text-gray-500">No themes identified.</p>}
            </Section>
            <Section icon={<Smile size={18} />} title="Sentiment" aside={s.sentiment?.overall ? <Badge v={SENTIMENT_BADGE[String(s.sentiment.overall).toLowerCase()] ?? 'gray'}>{cap(String(s.sentiment.overall))}</Badge> : undefined}>
              {s.sentiment?.details ? <p className="text-sm text-gray-700">{String(s.sentiment.details)}</p> : <p className="text-sm text-gray-500">No sentiment details.</p>}
            </Section>
          </div>
        )}

        {research.length > 0 && (
          <Section icon={<FileText size={18} />} title="Research Findings" chip={`${research.length}`}>
            <div className="space-y-4">
              {research.map((r, i) => (
                <div key={i} className="break-inside-avoid rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-navy">{r.question}</p>
                  {r.summary && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{r.summary}</p>}
                  {asArray<{ topic: string; details: string }>(r.keyTopics).length > 0 && <ul className="mt-3 space-y-1 text-xs text-gray-600">{asArray<{ topic: string; details: string }>(r.keyTopics).map((t, j) => <li key={j}><b className="text-gray-800">{t.topic}:</b> {t.details}</li>)}</ul>}
                  {asList(r.dataPoints).length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{asList(r.dataPoints).map((d, j) => <Badge key={j} v="blue">{d}</Badge>)}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Code written in the interview */}
        {snippets.length > 0 && (
          <Section icon={<Terminal size={18} />} title="Code Snippets" chip={`${snippets.length} snippet${snippets.length === 1 ? '' : 's'}`}>
            <div className="space-y-4">
              {snippets.map((m, i) => (
                <CodeBlock key={m.id} className="break-inside-avoid" code={m.whiteboardData?.code ?? m.content} language={m.whiteboardData?.language || 'plaintext'}
                  right={<span className="normal-case">{m.whiteboardData?.label || `Snippet ${i + 1}`} · {clock(m.timestamp)}</span>} />
              ))}
            </div>
          </Section>
        )}

        {violations.length > 0 && (
          <Section icon={<ShieldAlert size={18} className="text-amber" />} title="Integrity log" chip={`${violations.length}`}>
            <ul className="space-y-1 text-sm text-gray-700">
              {violations.map((v, i) => <li key={i}><b>{v.type.replace(/_/g, ' ')}</b>{v.detail ? ` — ${v.detail}` : ''} <span className="text-gray-500">· {new Date(v.timestamp).toLocaleTimeString()}</span></li>)}
            </ul>
          </Section>
        )}

        {/* Transcript (collapsible) */}
        <Card>
          <button type="button" className="flex w-full items-center justify-between gap-3 text-left print:cursor-default" aria-expanded={transcriptOpen} onClick={() => setTranscriptOpen((o) => !o)}>
            <h2 className="flex items-center gap-2 text-xl font-display font-bold text-navy">
              <span className="text-gray-500"><MessageCircle size={18} /></span>Transcript
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{transcript.length} messages</span>
            </h2>
            <ChevronDown size={18} className={cn('text-gray-500 transition-transform print:hidden', transcriptOpen && 'rotate-180')} />
          </button>
          <div className={cn('mt-4 space-y-3', !transcriptOpen && 'hidden print:block')}>
            {transcript.length === 0 ? <EmptyState title="No messages" body="Nothing was said in this session." /> : transcript.map((m) => {
              const mine = m.role === 'USER';
              const spoken = s.modeUsed !== 'CHAT' && m.transcription !== 'chat';
              return (
                <div key={m.id} className={cn('flex break-inside-avoid', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-xl px-4 py-2.5 text-sm', mine ? 'bg-green text-white' : 'bg-green-xlt text-navy')}>
                    <div className={cn('mb-1 flex items-center gap-2 text-[11px] font-semibold', mine ? 'text-white/80' : 'text-gray-600')}>
                      {mine ? (spoken ? <Mic size={11} /> : <MessageCircle size={11} />) : <Volume2 size={11} />}
                      <span>{mine ? 'Participant' : 'Interviewer'}</span>
                      <span className="ml-auto font-normal">{clock(m.timestamp)}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </EmployerShell>
  );
}
