// src/components/ui/admin/admin-overview.tsx
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, Building2, Flag, Trash2, CreditCard } from 'lucide-react';
import { Alert, Btn, Card, LoadingState } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { useAuditTrail, useOverview } from '@/api/admin/useAdminQueries';
import { timeAgo } from '@/lib/utils';
import { AdminMetrics } from './admin-metrics';

export function AdminOverview() {
  const navigate = useNavigate();
  const { data: o, isLoading, isError } = useOverview();
  const { data: audit = [] } = useAuditTrail();

  const queue = o && [
    { icon: <Building2 size={16} className="text-amber" />, label: 'Employers awaiting KYC review', n: o.pendingKyc, to: '/admin/employers' },
    { icon: <Flag size={16} className="text-red" />, label: 'Flagged interviews to review', n: o.openFlags, to: '/admin/interview' },
    { icon: <CreditCard size={16} className="text-blue" />, label: 'Open billing disputes', n: o.openDisputes, to: '/admin/payroll' },
    { icon: <Trash2 size={16} className="text-purple" />, label: 'Data deletion requests', n: o.pendingDeletions, to: '/admin/compliance' },
  ];

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Platform Overview</h1>
        <p className="text-sm text-gray-400 mt-0.5">What needs your attention right now</p>
      </div>
      {isLoading && <LoadingState msg="Loading overview…" />}
      {isError && <Alert v="error">Could not load the overview. Is the backend running?</Alert>}
      {o && (
        <>
          <AdminMetrics />
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-amber" /> Needs attention</h3>
              {queue!.map((i) => (
                <div key={i.label} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                  {i.icon}
                  <span className="flex-1 text-sm text-gray-700">{i.label}</span>
                  <span className={`font-bold ${i.n ? 'text-navy' : 'text-gray-300'}`}>{i.n}</span>
                  <Btn v="ghost" sz="sm" onClick={() => navigate({ to: i.to })}>Open →</Btn>
                </div>
              ))}
            </Card>
            <Card>
              <h3 className="font-display font-bold text-navy mb-4">Recent admin activity</h3>
              {audit.length === 0 && <p className="text-sm text-gray-400">Nothing yet.</p>}
              {audit.slice(0, 8).map((a) => (
                <div key={a.id} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="text-sm text-navy font-semibold">{a.action}</div>
                  <div className="text-xs text-gray-400">{a.actor ?? 'System'}{a.company ? ` · ${a.company}` : ''} · {timeAgo(a.created_at)}</div>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </AdminShell>
  );
}
