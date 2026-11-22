// src/components/ui/admin/admin-metrics.tsx
import { Building2, DollarSign, Users, Video } from 'lucide-react';
import { MetricCard } from '@/components/ui/common';
import { useOverview } from '@/api/admin/useAdminQueries';
import type { MetricCardProps } from '@/types';

const change = (pct: number | null) => (pct == null ? 'No earlier data' : `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs previous 30 days`);

export function AdminMetrics() {
  const { data: o } = useOverview();
  const metrics: MetricCardProps[] = [
    { icon: <Users size={20} />, value: o ? o.candidates.toLocaleString() : '—', label: 'Total Candidates', delta: o ? `↑ ${o.newCandidates7d} in 7 days` : '', up: true, accent: 'navy' },
    { icon: <Building2 size={20} />, value: o ? o.employers.toLocaleString() : '—', label: 'Employer Accounts', delta: o ? `↑ ${o.newEmployers30d} in 30 days` : '', up: true, accent: 'blue' },
    { icon: <Video size={20} />, value: o ? o.interviews30d.toLocaleString() : '—', label: 'Interviews (30d)', delta: o ? change(o.interviewsChangePct) : '', up: (o?.interviewsChangePct ?? 0) >= 0, accent: 'purple' },
    { icon: <DollarSign size={20} />, value: o ? `$${Math.round(o.gmv30d).toLocaleString()}` : '—', label: 'GMV (30d)', delta: o ? change(o.gmvChangePct) : '', up: (o?.gmvChangePct ?? 0) >= 0, accent: 'green' },
  ];
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{metrics.map((m) => <MetricCard key={m.label} {...m} />)}</div>;
}
