// src/components/ui/admin/admin-payroll.tsx
import { useState } from 'react';
import { AlertTriangle, CreditCard, Send } from 'lucide-react';
import { Alert, Badge, Btn, Card, DataTable, LoadingState, MetricCard } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { useDisputes, useFinance, useResolveDispute, useRunPayroll, type AdminFinance } from '@/api/admin/useAdminQueries';
import { apiErrorMessage, formatShortDate } from '@/lib/utils';

type Txn = AdminFinance['transactions'][number];
const STATUS_BADGE: Record<string, 'green' | 'blue' | 'red' | 'gray'> = { paid: 'green', processing: 'blue', failed: 'red', refunded: 'gray' };
const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function AdminPayroll() {
  const { data, isLoading, isError } = useFinance();
  const { data: disputes = [] } = useDisputes();
  const run = useRunPayroll();
  const resolve = useResolveDispute();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const runPayroll = () => {
    if (!window.confirm('Release all processing payments? This is a simulated run, so no real money moves.')) return;
    run.mutateAsync().then((r) => { setError(''); setInfo(`Payroll run complete: ${r.payments} payment(s), net ${fmt(r.totalNet)} (simulated).`); })
      .catch((e) => { setInfo(''); setError(apiErrorMessage(e)); });
  };

  const handle = (id: string, resolution: 'refunded' | 'rejected') => {
    const note = window.prompt(resolution === 'refunded' ? 'Refund this payment. Note (optional):' : 'Reject this dispute. Reason (optional):');
    if (note === null) return;
    resolve.mutateAsync({ id, resolution, note: note || undefined }).then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  };

  const m = data && [
    { icon: <CreditCard size={20} />, value: fmt(data.summary.gmv30d), label: 'GMV (30d)', delta: 'Gross billed', up: true },
    { icon: <Send size={20} />, value: fmt(data.summary.pendingPayouts), label: 'Pending Payouts', delta: 'Awaiting payroll run', up: false },
    { icon: <AlertTriangle size={20} />, value: String(data.summary.openDisputes), label: 'Open Disputes', delta: data.summary.openDisputes ? 'Action required' : 'All clear', up: data.summary.openDisputes === 0 },
  ];

  return (
    <AdminShell>
      <div className="mb-6"><h1 className="text-2xl font-display font-bold text-navy">Payroll & Billing</h1><p className="text-sm text-gray-400 mt-0.5">Payments, payroll runs and billing disputes</p></div>
      {isLoading && <LoadingState msg="Loading payments…" />}
      {isError && <Alert v="error">Could not load payments. Is the backend running?</Alert>}
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
      {info && <div className="mb-4"><Alert v="success">{info}</Alert></div>}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">{m!.map((x) => <MetricCard key={x.label} {...x} />)}</div>

          {disputes.length > 0 && (
            <Card className="mb-6">
              <h3 className="font-display font-bold text-navy mb-4">Open disputes</h3>
              {disputes.map((d) => (
                <div key={d.id} className="py-3 border-b border-gray-50 last:border-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <b className="text-navy">{d.employer}</b><span className="text-gray-400">→</span><span>{d.candidate}</span>
                    <Badge v="red">{fmt(d.gross_amount)}</Badge><span className="text-xs text-gray-400">{d.invoice_number} · {formatShortDate(d.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{d.reason}</p>
                  <div className="flex gap-2 mt-2">
                    <Btn v="primary" sz="sm" disabled={resolve.isPending} onClick={() => handle(d.id, 'refunded')}>Refund</Btn>
                    <Btn v="ghost" sz="sm" disabled={resolve.isPending} onClick={() => handle(d.id, 'rejected')}>Reject dispute</Btn>
                  </div>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
              <h3 className="font-display font-bold text-navy">Transactions</h3>
              <Btn v="primary" sz="sm" loading={run.isPending} onClick={runPayroll}>Process Payroll Run →</Btn>
            </div>
            <DataTable
              cols={[
                { key: 'employer', label: 'EMPLOYER', render: (v, r: Txn) => <div><b className="text-navy">{v}</b><div className="text-xs text-gray-400">{r.invoice_number}</div></div> },
                { key: 'candidate', label: 'CANDIDATE' },
                { key: 'gross_amount', label: 'GROSS', style: { textAlign: 'right' }, render: (v: number) => <b>{fmt(v)}</b> },
                { key: 'fee_amount', label: 'FEE', style: { textAlign: 'right' }, render: (v: number) => <span className="text-gray-500">{fmt(v)}</span> },
                { key: 'period_end', label: 'PERIOD END', render: (v: string) => formatShortDate(v) },
                {
                  key: 'status', label: 'STATUS', style: { textAlign: 'center' },
                  render: (v: string, r: Txn) => <div className="flex flex-col items-center gap-1"><Badge v={STATUS_BADGE[v] ?? 'gray'}>{v}</Badge>{r.disputed && <Badge v="red">disputed</Badge>}</div>,
                },
              ]}
              rows={data.transactions}
            />
            {data.transactions.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No payments yet.</p>}
          </Card>
        </>
      )}
    </AdminShell>
  );
}
