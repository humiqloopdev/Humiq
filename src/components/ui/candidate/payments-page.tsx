// src/components/ui/candidate/payments-page.tsx
import { useState } from 'react';
import { DollarSign, Download, TrendingUp, Clock, CreditCard, Building2, AlertCircle } from 'lucide-react';
import { Alert, Badge, Btn, Card, DataTable, EmptyState, LoadingState, MetricCard } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import { usePayments, type ApiPayments } from '@/api/candidate/useCandidateQueries';
import { formatShortDate, initials } from '@/lib/utils';

type Payment = ApiPayments['payments'][number];

const STATUS_BADGE: Record<string, 'green' | 'blue' | 'red'> = { paid: 'green', processing: 'blue', failed: 'red' };
const STATUS_LABEL: Record<string, string> = { paid: 'Paid', processing: 'Processing', failed: 'Failed' };

const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

function exportCsv(rows: Payment[]) {
  const head = ['Invoice', 'Employer', 'Period start', 'Period end', 'Hours', 'Gross', 'Fee', 'Net', 'Status'];
  const lines = rows.map((r) => [r.invoice_number, r.employer, r.period_start.slice(0, 10), r.period_end.slice(0, 10), r.hours, r.gross_amount, r.fee_amount, r.net_amount, r.status]
    .map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','));
  const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'payments.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

export function PaymentsPage() {
  const { data, isLoading, isError } = usePayments();
  const [year, setYear] = useState<string | null>(null);

  if (isLoading) return <CandidateShell><LoadingState msg="Loading payments…" /></CandidateShell>;
  if (isError || !data) return <CandidateShell><Alert v="error">Could not load payments. Is the backend running?</Alert></CandidateShell>;

  const years = [...new Set(data.payments.map((p) => p.period_end.slice(0, 4)))].sort().reverse();
  const selected = year ?? years[0] ?? null;
  const records = data.payments.filter((p) => p.period_end.startsWith(selected ?? ''));

  const paid = records.filter((r) => r.status === 'paid');
  const processing = records.filter((r) => r.status === 'processing');
  const totalEarned = paid.reduce((s, r) => s + r.net_amount, 0);
  const gross = records.reduce((s, r) => s + r.gross_amount, 0);
  const pending = processing.reduce((s, r) => s + r.net_amount, 0);
  const hours = records.reduce((s, r) => s + r.hours, 0);
  const avgRate = hours ? Math.round(gross / hours) : 0;
  const method = data.payoutMethods.find((m) => m.is_default) ?? data.payoutMethods[0];

  const metrics = [
    { icon: <DollarSign size={20} />, value: fmt(totalEarned), label: `Total Earned (${selected ?? '—'})`, delta: `${paid.length} paid`, up: true, accent: 'green' as const },
    { icon: <TrendingUp size={20} />, value: fmt(gross), label: 'Gross Billed', delta: 'Before platform fee', up: true, accent: 'navy' as const },
    { icon: <Clock size={20} />, value: fmt(pending), label: 'Pending Payout', delta: `${processing.length} processing`, up: true, accent: 'amber' as const },
    { icon: <CreditCard size={20} />, value: `$${avgRate}/hr`, label: 'Avg. Hourly Rate', delta: `${hours}h billed`, up: true, accent: 'blue' as const },
  ];

  // Net earnings per month, oldest first, for the chart
  const byMonth = new Map<string, number>();
  [...records].sort((a, b) => a.period_end.localeCompare(b.period_end))
    .forEach((r) => byMonth.set(monthLabel(r.period_end), (byMonth.get(monthLabel(r.period_end)) ?? 0) + r.net_amount));
  const chart = [...byMonth.entries()];
  const chartMax = Math.max(1, ...chart.map(([, v]) => v));

  return (
    <CandidateShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy">Payments</h1>
          <p className="text-sm text-gray-400 mt-0.5">Your earnings, payouts, and invoices</p>
        </div>
        <Btn v="outline" sz="sm" icon={<Download size={14} />} disabled={!records.length} onClick={() => exportCsv(records)}>Export CSV</Btn>
      </div>

      {data.payments.length === 0 ? (
        <EmptyState icon={<DollarSign size={36} />} title="No payments yet" body="Payments appear here once you start a contract." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          {method && (
            <Card className="mb-6">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-green-xlt rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-green" />
                </div>
                <div>
                  <div className="font-bold text-navy text-sm">{method.label}{method.account_last4 ? ` — •••• ${method.account_last4}` : ''}</div>
                  <div className="text-xs text-gray-400 capitalize">{method.method_type} · Default payout method</div>
                </div>
              </div>
            </Card>
          )}

          {processing.length > 0 && (
            <div className="bg-blue-lt border border-blue rounded-2xl p-4 mb-5 flex items-center gap-3">
              <AlertCircle size={16} className="text-blue flex-shrink-0" />
              <div className="text-xs text-blue">
                <span className="font-bold">{processing.length} payment{processing.length > 1 ? 's' : ''} processing:</span> {fmt(pending)} is on its way.
              </div>
            </div>
          )}

          {years.length > 1 && (
            <div className="flex items-center gap-3 mb-5">
              <span className="text-sm font-semibold text-gray-500">Year:</span>
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                    selected === y ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-navy hover:text-navy'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          <Card className="mb-6">
            <h3 className="font-display font-bold text-navy mb-4">Payment History</h3>
            <DataTable
              cols={[
                {
                  key: 'employer', label: 'Employer',
                  render: (_v, r: Payment) => (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-navy-lt flex items-center justify-center text-[10px] font-bold text-navy flex-shrink-0">{initials(r.employer)}</div>
                      <div>
                        <div className="font-semibold text-navy text-sm">{r.employer}</div>
                        <div className="text-xs text-gray-400">{r.invoice_number}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'period_end', label: 'Period',
                  render: (_v, r: Payment) => (
                    <div>
                      <div className="text-sm font-medium text-gray-700">{monthLabel(r.period_end)}</div>
                      <div className="text-xs text-gray-400">{r.hours}h</div>
                    </div>
                  ),
                },
                { key: 'gross_amount', label: 'Gross', style: { textAlign: 'right' }, render: (v: number) => <span className="text-gray-600">{fmt(v)}</span> },
                { key: 'fee_amount', label: 'Fee (10%)', style: { textAlign: 'right' }, render: (v: number) => <span className="text-gray-400 text-xs">−{fmt(v)}</span> },
                { key: 'net_amount', label: 'Net Payout', style: { textAlign: 'right' }, render: (v: number) => <span className="font-bold text-green">{fmt(v)}</span> },
                {
                  key: 'status', label: 'Status', style: { textAlign: 'center' },
                  render: (v: string, r: Payment) => (
                    <div>
                      <Badge v={STATUS_BADGE[v] ?? 'gray'}>{STATUS_LABEL[v] ?? v}</Badge>
                      {r.paid_at && <div className="text-[11px] text-gray-400 mt-0.5">{formatShortDate(r.paid_at)}</div>}
                    </div>
                  ),
                },
              ]}
              rows={records}
            />
          </Card>

          <Card flat>
            <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-green" /> Monthly Earnings
            </h3>
            <div className="flex items-end gap-3 h-24">
              {chart.map(([label, val]) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs font-bold text-green">{fmt(val)}</div>
                  <div className="w-full bg-green rounded-t-md" style={{ height: `${(val / chartMax) * 64}px`, opacity: 0.85 }} />
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </CandidateShell>
  );
}
