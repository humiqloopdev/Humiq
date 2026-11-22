// src/components/ui/admin/admin-employers.tsx
import { useState } from 'react';
import { Alert, Badge, Btn, Card, DataTable, LoadingState } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { useAdminEmployers, useSetEmployerPlan, useSetKyc, usePlans, type AdminEmployer } from '@/api/admin/useAdminQueries';
import { apiErrorMessage, formatShortDate } from '@/lib/utils';
import { AdminMetrics } from './admin-metrics';

const KYC_BADGE = { verified: 'green', pending: 'amber', rejected: 'red' } as const;

export function AdminEmployers() {
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const { data: employers = [], isLoading, isError } = useAdminEmployers({ kyc: filter || undefined });
  const { data: plans = [] } = usePlans();
  const setKyc = useSetKyc();
  const setPlan = useSetEmployerPlan();

  const run = (p: Promise<unknown>) => p.then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  const reject = (e: AdminEmployer) => {
    const notes = window.prompt(`Why is ${e.name} being rejected? (shown in the audit trail)`);
    if (notes === null) return;
    run(setKyc.mutateAsync({ id: e.id, status: 'rejected', notes: notes || undefined }));
  };

  return (
    <AdminShell>
      <div className="mb-6"><h1 className="text-2xl font-display font-bold text-navy">Employers</h1><p className="text-sm text-gray-400 mt-0.5">Company accounts, KYC verification and plans</p></div>
      <AdminMetrics />
      <div className="flex gap-2 mb-5">
        {[['', 'All'], ['pending', 'Pending KYC'], ['verified', 'Verified'], ['rejected', 'Rejected']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${filter === v ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-navy hover:text-navy'}`}>{l}</button>
        ))}
      </div>
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
      {isLoading && <LoadingState msg="Loading employers…" />}
      {isError && <Alert v="error">Could not load employers. Is the backend running?</Alert>}
      {!isLoading && !isError && (
        <Card flat>
          <DataTable
            cols={[
              { key: 'name', label: 'COMPANY', render: (v, r: AdminEmployer) => <div><b className="text-navy">{v}</b><div className="text-xs text-gray-400">{r.industry ?? '—'} · {r.members} member{r.members === 1 ? '' : 's'}</div></div> },
              {
                key: 'plan', label: 'PLAN',
                render: (v: AdminEmployer['plan'], r: AdminEmployer) => (
                  <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white" value={v} disabled={setPlan.isPending}
                    onChange={(e) => run(setPlan.mutateAsync({ id: r.id, plan: e.target.value }))}>
                    {(plans.length ? plans : [{ code: v, name: v, isActive: true }]).filter((p) => p.isActive || p.code === v).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                ),
              },
              { key: 'active_roles', label: 'ACTIVE ROLES', style: { textAlign: 'center' } },
              { key: 'created_at', label: 'JOINED', render: (v: string) => formatShortDate(v) },
              { key: 'kyc_status', label: 'KYC', style: { textAlign: 'center' }, render: (v: AdminEmployer['kyc_status']) => <Badge v={KYC_BADGE[v]}>{v}</Badge> },
              {
                key: 'id', label: '',
                render: (_v, r: AdminEmployer) => (
                  <div className="flex gap-1.5 justify-end">
                    {r.kyc_status !== 'verified' && <Btn v="primary" sz="sm" loading={setKyc.isPending && setKyc.variables?.id === r.id} onClick={() => run(setKyc.mutateAsync({ id: r.id, status: 'verified' }))}>Verify</Btn>}
                    {r.kyc_status !== 'rejected' && <Btn v="ghost" sz="sm" onClick={() => reject(r)}>Reject</Btn>}
                  </div>
                ),
              },
            ]}
            rows={employers}
          />
          {employers.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No employers in this view.</p>}
        </Card>
      )}
    </AdminShell>
  );
}
