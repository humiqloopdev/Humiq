// src/components/ui/admin/admin-jobs.tsx
import { useState } from 'react';
import { Briefcase, ClipboardList, Zap } from 'lucide-react';
import { Alert, Badge, Btn, Card, DataTable, LoadingState, MetricCard, SearchBar } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { useAdminJobs, useModerateJob, type AdminJob } from '@/api/admin/useAdminQueries';
import { apiErrorMessage, formatShortDate } from '@/lib/utils';

const MOD_BADGE = { approved: 'green', flagged: 'amber', removed: 'red' } as const;
const STATUS_BADGE: Record<string, 'green' | 'amber' | 'gray' | 'blue'> = { active: 'green', paused: 'amber', closed: 'gray', draft: 'blue' };

export function AdminJobs() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [moderation, setModeration] = useState('');
  const [error, setError] = useState('');
  const { data, isLoading, isError } = useAdminJobs({ q: search || undefined, moderation: moderation || undefined });
  const moderate = useModerateJob();

  const act = (job: AdminJob, action: 'flag' | 'approve' | 'remove' | 'restore') => {
    let note: string | undefined;
    if (action === 'remove' || action === 'flag') {
      const reply = window.prompt(`${action === 'remove' ? 'Remove' : 'Flag'} "${job.title}". Reason (optional):`);
      if (reply === null) return;
      note = reply || undefined;
    }
    moderate.mutateAsync({ id: job.id, action, note }).then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  };

  const m = data && [
    { icon: <Briefcase size={20} />, value: String(data.stats.activeListings), label: 'Active Listings' },
    { icon: <ClipboardList size={20} />, value: data.stats.totalApplications.toLocaleString(), label: 'Total Applications' },
    { icon: <Zap size={20} />, value: String(data.stats.filled30d), label: 'Roles Filled (30d)' },
  ];

  return (
    <AdminShell>
      <div className="mb-6"><h1 className="text-2xl font-display font-bold text-navy">Job Listings</h1><p className="text-sm text-gray-400 mt-0.5">Monitor and moderate job postings</p></div>
      {isLoading && <LoadingState msg="Loading listings…" />}
      {isError && <Alert v="error">Could not load job listings. Is the backend running?</Alert>}
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">{m!.map((x) => <MetricCard key={x.label} {...x} />)}</div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="flex-1"><SearchBar placeholder="Search title or company…" value={q} onChange={setQ} onSearch={() => setSearch(q.trim())} /></div>
            <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" value={moderation} onChange={(e) => setModeration(e.target.value)}>
              <option value="">All moderation states</option><option value="approved">Approved</option><option value="flagged">Flagged</option><option value="removed">Removed</option>
            </select>
          </div>
          <Card flat>
            <DataTable
              cols={[
                { key: 'title', label: 'JOB TITLE', render: (v, r: AdminJob) => <div><b className="text-navy">{v}</b>{r.moderation_note && <div className="text-xs text-gray-400">Note: {r.moderation_note}</div>}</div> },
                { key: 'company_name', label: 'COMPANY' },
                { key: 'applicants', label: 'APPLICANTS', style: { textAlign: 'center' } },
                { key: 'posted_at', label: 'POSTED', render: (v: string) => formatShortDate(v) },
                { key: 'status', label: 'STATUS', style: { textAlign: 'center' }, render: (v: string) => <Badge v={STATUS_BADGE[v] ?? 'gray'}>{v}</Badge> },
                { key: 'moderation_status', label: 'MODERATION', style: { textAlign: 'center' }, render: (v: AdminJob['moderation_status']) => <Badge v={MOD_BADGE[v]}>{v}</Badge> },
                {
                  key: 'id', label: '',
                  render: (_v, r: AdminJob) => (
                    <div className="flex gap-1.5 justify-end">
                      {r.moderation_status === 'approved' && <Btn v="ghost" sz="sm" onClick={() => act(r, 'flag')}>Flag</Btn>}
                      {r.moderation_status === 'flagged' && <Btn v="outline" sz="sm" onClick={() => act(r, 'approve')}>Approve</Btn>}
                      {r.moderation_status !== 'removed' && <Btn v="ghost" sz="sm" onClick={() => act(r, 'remove')}>Remove</Btn>}
                      {r.moderation_status === 'removed' && <Btn v="outline" sz="sm" onClick={() => act(r, 'restore')}>Restore</Btn>}
                    </div>
                  ),
                },
              ]}
              rows={data.jobs}
            />
          </Card>
        </>
      )}
    </AdminShell>
  );
}
