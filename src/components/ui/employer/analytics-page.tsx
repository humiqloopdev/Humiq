// src/components/ui/employer/analytics-page.tsx
import { BarChart3, Clock, DollarSign, Eye, Star, Target, Users } from 'lucide-react';
import { Alert, Card, EmptyState, LoadingState, MetricCard } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { useEmployerAnalytics } from '@/api/employer/useEmployerQueries';

const SOURCE_LABEL: Record<string, string> = {
  direct: 'Direct Apply', referral: 'Referral', job_board: 'Job Boards', ai_search: 'Talent Search', employer: 'Sourced by you',
};
const SOURCE_COLOR = ['#1D9E75', '#1D6FBF', '#B45309', '#5B21B6', '#1A3A5C'];
const FUNNEL_COLOR = ['#1A3A5C', '#1D6FBF', '#B45309', '#5B21B6', '#1D9E75', '#0F6E56'];

function BarChart({ data, color = '#1D9E75' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="text-[10px] font-bold text-gray-500">{d.value}</div>
          <div className="w-full rounded-t-md transition-all duration-500" style={{ height: `${(d.value / max) * 96}px`, backgroundColor: color, opacity: 0.85 }} />
          <div className="text-[10px] text-gray-400">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function HBar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-bold text-navy">{value} · {pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function FunnelStep({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 last:mb-0">
      <div className="w-28 text-xs font-semibold text-gray-600 text-right">{label}</div>
      <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden relative">
        <div className="h-full rounded-lg transition-all" style={{ width: `${Math.max(pct, value ? 2 : 0)}%`, backgroundColor: color, opacity: 0.9 }} />
        <span className="absolute inset-0 flex items-center px-3 text-xs font-bold text-white mix-blend-normal">{value}</span>
      </div>
      <div className="text-xs text-gray-400 w-10">{pct}%</div>
    </div>
  );
}

export function AnalyticsPage() {
  const { data, isLoading, isError } = useEmployerAnalytics();

  if (isLoading) return <EmployerShell><LoadingState msg="Crunching your numbers…" /></EmployerShell>;
  if (isError || !data) return <EmployerShell><Alert v="error">Could not load analytics. Is the backend running and your company set up?</Alert></EmployerShell>;

  const applied = data.funnel[0]?.count ?? 0;
  const metrics = [
    { icon: <Users size={20} />, value: String(applied), label: 'Total Applicants', delta: 'All roles', up: true, accent: 'navy' as const },
    { icon: <Target size={20} />, value: `${data.hireRate}%`, label: 'Hire Rate', delta: 'Hired / applied', up: true, accent: 'green' as const },
    { icon: <Clock size={20} />, value: data.avgDaysToHire != null ? `${data.avgDaysToHire}d` : '—', label: 'Time to Hire', delta: data.avgDaysToHire == null ? 'No hires yet' : 'Applied to hired', up: true, accent: 'blue' as const },
    { icon: <DollarSign size={20} />, value: `$${Math.round(data.spendYtd).toLocaleString()}`, label: 'Total Spend (YTD)', delta: 'Gross payroll', up: false, accent: 'amber' as const },
  ];

  return (
    <EmployerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">Hiring performance & spend insights</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{metrics.map((m) => <MetricCard key={m.label} {...m} />)}</div>

      {applied === 0 ? (
        <EmptyState icon={<BarChart3 size={36} />} title="No data yet" body="Charts appear once candidates start applying." />
      ) : (
        <>
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <h3 className="font-display font-bold text-navy mb-5 flex items-center gap-2"><Target size={16} className="text-amber" /> Hiring Funnel</h3>
              {data.funnel.map((f, i) => (
                <FunnelStep key={f.label} label={f.label} value={f.count} pct={applied ? Math.round((100 * f.count) / applied) : 0} color={FUNNEL_COLOR[i]} />
              ))}
            </Card>
            <Card>
              <h3 className="font-display font-bold text-navy mb-5 flex items-center gap-2"><Star size={16} className="text-amber" /> Candidate Sources</h3>
              {data.sources.map((s, i) => (
                <HBar key={s.source} label={SOURCE_LABEL[s.source] ?? s.source} value={s.count} pct={s.percent} color={SOURCE_COLOR[i % SOURCE_COLOR.length]} />
              ))}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-green" /> Applications per Week</h3>
              {data.weeklyApplicants.length ? (
                <BarChart data={data.weeklyApplicants.map((w) => ({ label: w.week, value: w.applicants }))} />
              ) : <p className="text-sm text-gray-400">No applications in the last 8 weeks.</p>}
            </Card>
            <Card>
              <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2"><Eye size={16} className="text-purple" /> Other Numbers</h3>
              {[
                ['Job views', String(data.jobViews)],
                ['Avg time to shortlist', data.avgDaysToShortlist != null ? `${data.avgDaysToShortlist} days` : '—'],
                ['Avg AI interview score', data.avgAiScore != null ? `${data.avgAiScore}/100` : '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0 text-sm">
                  <span className="text-gray-500">{l}</span><span className="font-bold text-navy">{v}</span>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </EmployerShell>
  );
}
