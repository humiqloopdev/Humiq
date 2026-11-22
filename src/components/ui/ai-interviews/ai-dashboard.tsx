// src/components/ui/ai-interviews/ai-dashboard.tsx
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Clock, HelpCircle, MessageSquare, Users, Video } from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, LoadingState, MetricCard } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { apiErrorMessage, formatShortDate, timeAgo } from '@/lib/utils';
import { useAiDashboard } from '@/api/aiInterviews/useAiInterviews';
import { fmtDuration, QUESTION_TYPE_LABEL, scoreTone, STATUS_BADGE } from './ai-bits';

/** 30-day bar chart drawn as inline SVG (no charting dependency). */
function DailyChart({ daily }: { daily: { date: string; sessions: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.sessions));
  const w = 600;
  const h = 140;
  const bar = w / daily.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full h-44" role="img" aria-label="Sessions per day, last 30 days">
      {daily.map((d, i) => {
        const bh = (d.sessions / max) * h;
        return (
          <g key={d.date}>
            <rect x={i * bar + 2} y={h - bh} width={Math.max(2, bar - 4)} height={Math.max(bh, d.sessions ? 2 : 0)} rx={2} className="fill-green/80">
              <title>{`${formatShortDate(d.date)}: ${d.sessions} session${d.sessions === 1 ? '' : 's'}`}</title>
            </rect>
            {(i === 0 || i === daily.length - 1 || i === Math.floor(daily.length / 2)) && (
              <text x={i * bar + bar / 2} y={h + 14} textAnchor="middle" className="fill-gray-400 text-[10px]">{formatShortDate(d.date)}</text>
            )}
          </g>
        );
      })}
      <line x1={0} y1={h} x2={w} y2={h} className="stroke-gray-200" />
    </svg>
  );
}

function Breakdown({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">{r.label}</span><b className="text-navy">{r.value}</b></div>
          <div className="h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-green" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function AiDashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAiDashboard();

  if (isLoading) return <EmployerShell><LoadingState msg="Loading AI interview stats…" /></EmployerShell>;
  if (error || !data) return <EmployerShell><Alert v="error">{apiErrorMessage(error, 'Could not load the dashboard. Is the backend running?')}</Alert></EmployerShell>;

  const metrics = [
    { icon: <Video size={20} />, value: String(data.totalInterviews), label: 'Interviews', delta: `${data.totalQuestions} questions`, up: true, accent: 'navy' as const },
    { icon: <Users size={20} />, value: String(data.totalSessions), label: 'Sessions', delta: `${data.statusBreakdown.IN_PROGRESS} in progress`, up: true, accent: 'blue' as const },
    { icon: <CheckCircle2 size={20} />, value: `${data.completionRate}%`, label: 'Completion Rate', delta: `${data.statusBreakdown.COMPLETED} completed`, up: true, accent: 'green' as const },
    { icon: <Clock size={20} />, value: fmtDuration(data.avgSessionDuration), label: 'Avg Duration', delta: `${fmtDuration(data.totalDuration)} total`, up: true, accent: 'amber' as const },
    { icon: <MessageSquare size={20} />, value: String(data.totalMessages), label: 'Messages', delta: `${data.avgMessagesPerSession} per session`, up: true, accent: 'purple' as const },
    { icon: <HelpCircle size={20} />, value: String(data.totalQuestions), label: 'Questions', delta: 'Across all interviews', up: true, accent: 'gray' as const },
  ];

  return (
    <EmployerShell navRight={<Btn v="primary" sz="sm" onClick={() => navigate({ to: '/employer/ai/interviews/new' })}>+ New Interview</Btn>}>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">AI Interviews Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">How your AI-led interviews are performing</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>

      <Card className="mb-6">
        <h3 className="font-display font-bold text-navy mb-3">Sessions — last 30 days</h3>
        <DailyChart daily={data.daily} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <h3 className="font-display font-bold text-navy mb-4">Session status</h3>
          <Breakdown rows={[
            { label: 'Completed', value: data.statusBreakdown.COMPLETED },
            { label: 'In progress', value: data.statusBreakdown.IN_PROGRESS },
            { label: 'Not started / abandoned', value: data.statusBreakdown.NOT_STARTED },
          ]} />
        </Card>
        <Card>
          <h3 className="font-display font-bold text-navy mb-4">Question types</h3>
          <Breakdown rows={Object.entries(data.questionTypeBreakdown).map(([k, v]) => ({ label: QUESTION_TYPE_LABEL[k as keyof typeof QUESTION_TYPE_LABEL], value: v }))} />
        </Card>
        <Card>
          <h3 className="font-display font-bold text-navy mb-4">Top themes</h3>
          {data.topThemes.length === 0
            ? <p className="text-sm text-gray-400">Themes appear after you generate session reports.</p>
            : <div className="flex flex-wrap gap-2">{data.topThemes.map((t) => <Badge key={t.theme} v="blue">{t.theme} · {t.count}</Badge>)}</div>}
        </Card>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display font-bold text-navy">Recent completed sessions</h3>
          <Btn v="outline" sz="sm" onClick={() => navigate({ to: '/employer/ai/sessions' })}>View all</Btn>
        </div>
        {data.recentSessions.length === 0 ? (
          <EmptyState icon={<Users size={36} />} title="No completed sessions yet" body="Publish an interview and invite candidates to see results here." />
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentSessions.map((s) => (
              <button key={s.id} type="button" onClick={() => navigate({ to: '/employer/ai/sessions/$sessionId', params: { sessionId: s.id } })}
                className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-gray-50 px-2 rounded-lg">
                <div className="min-w-0">
                  <div className="font-semibold text-navy text-sm truncate">{s.name}</div>
                  <div className="text-xs text-gray-400">{fmtDuration(s.duration)} · {s.messages} messages · {timeAgo(s.date)}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {s.score != null && <span className={`text-sm font-bold ${scoreTone(s.score)}`}>{s.score.toFixed(1)}/10</span>}
                  <Badge v={STATUS_BADGE[s.status]?.v ?? 'gray'}>{STATUS_BADGE[s.status]?.label ?? s.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </EmployerShell>
  );
}
