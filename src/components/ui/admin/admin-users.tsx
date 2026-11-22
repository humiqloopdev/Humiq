// src/components/ui/admin/admin-users.tsx
import { useState } from 'react';
import { Send } from 'lucide-react';
import { Alert, Badge, Btn, Card, DataTable, LoadingState, SearchBar } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { useAdminUsers, useSetUserStatus, type AdminUser } from '@/api/admin/useAdminQueries';
import * as AdminAPI from '@/api/admin/adminApi';
import { apiErrorMessage, formatShortDate } from '@/lib/utils';
import { AdminMetrics } from './admin-metrics';

const STATUS_BADGE = { active: 'green', suspended: 'red', deleted: 'gray' } as const;
const SELECT = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white';
const PAGE = 25;

export function AdminUsers() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const params = { q: search || undefined, role: role || undefined, status: status || undefined, page, pageSize: PAGE };
  const { data, isLoading, isError } = useAdminUsers(params);
  const setUserStatus = useSetUserStatus();

  const toggle = (u: AdminUser) => {
    const next = u.status === 'suspended' ? 'active' : 'suspended';
    if (next === 'suspended' && !window.confirm(`Suspend ${u.name}? They will be signed out immediately.`)) return;
    setUserStatus.mutateAsync({ id: u.id, status: next }).then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  };

  const exportCsv = async () => {
    try {
      const res = await AdminAPI.exportUsers({ q: search || undefined, role: role || undefined, status: status || undefined });
      const url = URL.createObjectURL(res.data);
      Object.assign(document.createElement('a'), { href: url, download: 'users.csv' }).click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(apiErrorMessage(e, 'Export failed'));
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <AdminShell>
      <div className="mb-6"><h1 className="text-2xl font-display font-bold text-navy">Users</h1><p className="text-sm text-gray-400 mt-0.5">All accounts on the platform</p></div>
      <AdminMetrics />
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1"><SearchBar placeholder="Search name, email or username…" value={q} onChange={setQ} onSearch={() => { setSearch(q.trim()); setPage(1); }} /></div>
        <div className="flex flex-wrap gap-2">
          <select className={SELECT} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">All roles</option><option value="candidate">Candidates</option><option value="employer">Employers</option><option value="admin">Admins</option>
          </select>
          <select className={SELECT} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deleted">Deleted</option>
          </select>
          <Btn v="primary" sz="sm" icon={<Send size={13} />} onClick={exportCsv}>Export CSV</Btn>
        </div>
      </div>
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
      {isLoading && <LoadingState msg="Loading users…" />}
      {isError && <Alert v="error">Could not load users. Is the backend running?</Alert>}
      {data && (
        <Card flat>
          <DataTable
            cols={[
              { key: 'name', label: 'NAME', render: (v, r: AdminUser) => <div><div className="font-bold text-navy">{v}</div><div className="text-xs text-gray-400">{r.email}{r.company ? ` · ${r.company}` : ''}</div></div> },
              { key: 'created_at', label: 'JOINED', render: (v: string) => formatShortDate(v) },
              { key: 'role', label: 'ROLE', render: (v: string) => <Badge v={v === 'admin' ? 'purple' : v === 'employer' ? 'amber' : 'blue'}>{v}</Badge> },
              { key: 'ai_score', label: 'AI SCORE', style: { textAlign: 'center' }, render: (v: number | null) => <b className="text-green">{v ?? '–'}</b> },
              { key: 'status', label: 'STATUS', style: { textAlign: 'center' }, render: (v: AdminUser['status']) => <Badge v={STATUS_BADGE[v]}>{v}</Badge> },
              {
                key: 'id', label: '',
                render: (_v, r: AdminUser) => r.status === 'deleted' || r.role === 'admin' ? null : (
                  <Btn v={r.status === 'suspended' ? 'outline' : 'ghost'} sz="sm" loading={setUserStatus.isPending && setUserStatus.variables?.id === r.id} onClick={() => toggle(r)}>
                    {r.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                  </Btn>
                ),
              },
            ]}
            rows={data.results}
          />
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>{data.total} user{data.total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <Btn v="outline" sz="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</Btn>
              <span>Page {page} of {totalPages}</span>
              <Btn v="outline" sz="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</Btn>
            </div>
          </div>
        </Card>
      )}
    </AdminShell>
  );
}
