// src/components/ui/employer/payroll-page.tsx
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, CreditCard, DollarSign, Download, TrendingUp } from 'lucide-react';
import { Alert, Badge, Btn, Card, DataTable, EmptyState, LoadingState, MetricCard } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { useEmployerPayroll, type EmpPayroll } from '@/api/employer/useEmployerQueries';
import { initials } from '@/lib/utils';

type Row = EmpPayroll['payments'][number];

const STATUS_BADGE: Record<string, 'green' | 'blue' | 'red'> = { paid: 'green', processing: 'blue', failed: 'red' };
const STATUS_LABEL: Record<string, string> = { paid: 'Paid', processing: 'Processing', failed: 'Failed' };
const STATUS_ICON: Record<string, React.ReactNode> = {
  paid: <CheckCircle2 size={14} className="text-green" />, processing: <Clock size={14} className="text-blue" />, failed: <AlertCircle size={14} className="text-red" />,
};

const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

function exportCsv(rows: Row[]) {
  const head = ['Invoice', 'Contractor', 'Role', 'Period end', 'Hours', 'Rate', 'Gross', 'Fee', 'Net', 'Status'];
  const lines = rows.map((r) => [r.invoice_number, r.contractor, r.role, r.period_end.slice(0, 10), r.hours, r.hourly_rate, r.gross_amount, r.fee_amount, r.net_amount, r.status]
    .map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','));
  const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: 'payroll.csv' }).click();
  URL.revokeObjectURL(url);
}

export function PayrollPage() {
  const { data, isLoading, isError } = useEmployerPayroll();
  const [period, setPeriod] = useState<string | null>(null);

  if (isLoading) return <EmployerShell><LoadingState msg="Loading payroll…" /></EmployerShell>;
  if (isError || !data) return <EmployerShell><Alert v="error">Could not load payroll. Is the backend running and your company set up?</Alert></EmployerShell>;

  const periods = [...new Set(data.payments.map((p) => monthLabel(p.period_end)))];
  const selected = period ?? periods[0] ?? null;
  const rows = data.payments.filter((p) => monthLabel(p.period_end) === selected);
  const sum = (key: 'gross_amount' | 'fee_amount' | 'net_amount') => rows.reduce((s, r) => s + r[key], 0);
  const pending = rows.filter((r) => r.status !== 'paid');

  const metrics = [
    { icon: <DollarSign size={20} />, value: fmt(sum('gross_amount')), label: 'Total Payroll', delta: selected ?? '—', up: true, accent: 'navy' as const },
    { icon: <CreditCard size={20} />, value: fmt(rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.net_amount, 0)), label: 'Net Disbursed', delta: 'After 10% fee', up: true, accent: 'green' as const },
    { icon: <AlertCircle size={20} />, value: String(pending.length), label: 'Pending Payments', delta: pending.length ? 'Processing' : 'All clear', up: pending.length === 0, accent: pending.length ? 'amber' as const : 'green' as const },
    { icon: <TrendingUp size={20} />, value: fmt(sum('fee_amount')), label: 'Platform Fees', delta: '10% of gross', up: false, accent: 'blue' as const },
  ];

  return (
    <EmployerShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy">Payroll</h1>
          <p className="text-sm text-gray-400 mt-0.5">Contractor payments · {data.summary.activeContractors} active contractor{data.summary.activeContractors === 1 ? '' : 's'}</p>
        </div>
        <Btn v="outline" sz="sm" icon={<Download size={14} />} disabled={!rows.length} onClick={() => exportCsv(rows)}>Export CSV</Btn>
      </div>

      {data.payments.length === 0 ? (
        <EmptyState icon={<DollarSign size={36} />} title="No payroll yet" body="Payments appear here once a candidate accepts an offer and starts work." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{metrics.map((m) => <MetricCard key={m.label} {...m} />)}</div>

          {periods.length > 1 && (
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-sm font-semibold text-gray-500">Billing Period:</span>
              {periods.map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${selected === p ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-navy hover:text-navy'}`}>{p}</button>
              ))}
            </div>
          )}

          <Card className="mb-6">
            <h3 className="font-display font-bold text-navy mb-4">Payroll Breakdown · {selected}</h3>
            <DataTable
              cols={[
                {
                  key: 'contractor', label: 'Contractor',
                  render: (_v, r: Row) => (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-navy-lt flex items-center justify-center text-xs font-bold text-navy flex-shrink-0">{initials(r.contractor)}</div>
                      <div><div className="font-semibold text-navy text-sm">{r.contractor}</div><div className="text-xs text-gray-400">{r.role} · {r.invoice_number}</div></div>
                    </div>
                  ),
                },
                { key: 'hours', label: 'Hours', style: { textAlign: 'center' }, render: (v: number) => <span className="font-semibold text-navy">{v}h</span> },
                { key: 'hourly_rate', label: 'Rate', style: { textAlign: 'center' }, render: (v: number) => <span className="text-gray-600">${v}/hr</span> },
                { key: 'gross_amount', label: 'Gross', style: { textAlign: 'right' }, render: (v: number) => <span className="font-bold text-navy">{fmt(v)}</span> },
                { key: 'fee_amount', label: 'Fee (10%)', style: { textAlign: 'right' }, render: (v: number) => <span className="text-gray-500">{fmt(v)}</span> },
                { key: 'net_amount', label: 'Net', style: { textAlign: 'right' }, render: (v: number) => <span className="font-bold text-green">{fmt(v)}</span> },
                {
                  key: 'status', label: 'Status', style: { textAlign: 'center' },
                  render: (v: string) => <div className="flex items-center justify-center gap-1.5">{STATUS_ICON[v]}<Badge v={STATUS_BADGE[v] ?? 'gray'}>{STATUS_LABEL[v] ?? v}</Badge></div>,
                },
              ]}
              rows={rows}
            />
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap justify-end gap-4 sm:gap-8 text-sm">
              <div className="text-right"><div className="text-xs text-gray-400 mb-0.5">Total Gross</div><div className="font-bold text-navy">{fmt(sum('gross_amount'))}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400 mb-0.5">Total Fees</div><div className="font-bold text-gray-500">{fmt(sum('fee_amount'))}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400 mb-0.5">Total Net</div><div className="font-display font-extrabold text-green text-lg">{fmt(sum('net_amount'))}</div></div>
            </div>
          </Card>
        </>
      )}
    </EmployerShell>
  );
}
