// src/components/ui/admin/admin-compliance.tsx
import { useState } from 'react';
import { CheckCircle2, ClipboardList, Trash2 } from 'lucide-react';
import { Alert, Badge, Btn, Card, DataTable, LoadingState, MetricCard } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { useAuditTrail, useCompliance, useDeletions, useProcessDeletion, type AdminDeletion } from '@/api/admin/useAdminQueries';
import { apiErrorMessage, formatShortDate, timeAgo } from '@/lib/utils';

export function AdminCompliance() {
  const { data, isLoading, isError } = useCompliance();
  const { data: deletions = [] } = useDeletions();
  const { data: audit = [] } = useAuditTrail();
  const erasure = useProcessDeletion();
  const [error, setError] = useState('');

  const erase = (d: AdminDeletion) => {
    if (!window.confirm(`Anonymise ${d.name} (${d.email})? Their name, email and profile will be wiped and the account disabled. This cannot be undone. Payments and contracts are kept for accounting.`)) return;
    erasure.mutateAsync(d.id).then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  };

  const m = data && [
    { icon: <CheckCircle2 size={20} />, value: String(data.summary.overdueDeletions), label: 'Overdue Requests', delta: data.summary.overdueDeletions ? 'Past the 30-day deadline' : 'None overdue', up: data.summary.overdueDeletions === 0 },
    { icon: <Trash2 size={20} />, value: String(data.summary.pendingDeletions), label: 'Deletion Requests', delta: 'Pending', up: false },
    { icon: <ClipboardList size={20} />, value: data.summary.auditEvents.toLocaleString(), label: 'Audit Events', delta: 'All admin actions logged', up: true },
  ];

  return (
    <AdminShell>
      <div className="mb-6"><h1 className="text-2xl font-display font-bold text-navy">Compliance</h1><p className="text-sm text-gray-400 mt-0.5">Data erasure requests and the audit trail</p></div>
      {isLoading && <LoadingState />}
      {isError && <Alert v="error">Could not load compliance data. Is the backend running?</Alert>}
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">{m!.map((x) => <MetricCard key={x.label} {...x} />)}</div>
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="font-display font-bold text-navy mb-5">Data Policies</h3>
              <DataTable
                cols={[
                  { key: 'policy', label: 'POLICY', render: (v) => <b>{v}</b> },
                  { key: 'status', label: 'STATUS', render: (v: string) => <span className="flex items-center gap-2"><CheckCircle2 size={13} className="text-green" />{v}</span> },
                ]}
                rows={data.policies}
              />
            </Card>
            <Card>
              <h3 className="font-display font-bold text-navy mb-5">Pending Deletion Requests</h3>
              {deletions.length === 0 ? <p className="text-sm text-gray-400">No pending requests.</p> : (
                <DataTable
                  cols={[
                    { key: 'name', label: 'USER', render: (v, r: AdminDeletion) => <div><b>{v}</b><div className="text-xs text-gray-400">{r.email}</div></div> },
                    { key: 'requested_at', label: 'REQUESTED', render: (v: string) => formatShortDate(v) },
                    { key: 'due_at', label: 'DUE', render: (v: string, r: AdminDeletion) => <Badge v={r.overdue ? 'red' : 'amber'}>{formatShortDate(v)}</Badge> },
                    { key: 'id', label: '', render: (_v, r: AdminDeletion) => <Btn v="outline" sz="sm" loading={erasure.isPending && erasure.variables === r.id} onClick={() => erase(r)}>Process</Btn> },
                  ]}
                  rows={deletions}
                />
              )}
            </Card>
          </div>
          <Card>
            <h3 className="font-display font-bold text-navy mb-5">Audit Trail</h3>
            <DataTable
              cols={[
                { key: 'action', label: 'ACTION', render: (v) => <b className="text-navy">{v}</b> },
                { key: 'actor', label: 'BY', render: (v: string | null) => v ?? 'System' },
                { key: 'company', label: 'COMPANY', render: (v: string | null) => v ?? '—' },
                { key: 'created_at', label: 'WHEN', render: (v: string) => timeAgo(v) },
              ]}
              rows={audit}
            />
          </Card>
        </>
      )}
    </AdminShell>
  );
}
