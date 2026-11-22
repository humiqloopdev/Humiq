// src/components/ui/employer/team-page.tsx
import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { Alert, Badge, Btn, Card, Input, LoadingState } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { useCompany, useInviteTeam, useRemoveTeamEntry, useTeam } from '@/api/employer/useEmployerQueries';
import { apiErrorMessage, initials } from '@/lib/utils';

const ROLE_BADGE: Record<string, 'purple' | 'blue' | 'green' | 'gray'> = { owner: 'purple', admin: 'blue', recruiter: 'green', viewer: 'gray' };
const ROLE_HELP: Record<string, string> = {
  admin: 'Manage team, jobs and pipeline', recruiter: 'Manage jobs and move candidates', viewer: 'Read-only access',
};

export function TeamPage() {
  const { data: company } = useCompany();
  const { data: team, isLoading, isError } = useTeam();
  const invite = useInviteTeam();
  const remove = useRemoveTeamEntry();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('recruiter');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const canManage = company?.role === 'owner' || company?.role === 'admin';

  const send = () =>
    invite.mutateAsync({ email: email.trim(), role })
      .then((res) => {
        setNote(`Invitation created for ${email.trim()}. There is no email service yet, so share this code with them: ${res.token}`);
        setEmail(''); setError('');
      })
      .catch((e) => { setNote(''); setError(apiErrorMessage(e)); });

  const del = (id: string | number, label: string) => {
    if (!window.confirm(`Remove ${label}?`)) return;
    remove.mutateAsync(id).then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  };

  return (
    <EmployerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Team</h1>
        <p className="text-sm text-gray-400 mt-0.5">People who can work in your company's hiring account</p>
      </div>

      {isLoading && <LoadingState msg="Loading team…" />}
      {isError && <Alert v="error">Could not load your team. Is the backend running and your company set up?</Alert>}
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
      {note && <div className="mb-4"><Alert v="success">{note}</Alert></div>}

      {team && (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <h3 className="font-display font-bold text-navy mb-4">Members</h3>
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                <div className="w-9 h-9 rounded-full bg-navy-lt flex items-center justify-center font-bold text-navy text-xs">{initials(m.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy text-sm truncate">{m.name}</div>
                  <div className="text-xs text-gray-400 truncate">{m.email}</div>
                </div>
                <Badge v={ROLE_BADGE[m.role]}>{m.role}</Badge>
                {canManage && m.role !== 'owner' && (
                  <button onClick={() => del(m.id, m.name)} className="p-1.5 rounded-lg text-red hover:bg-red-lt cursor-pointer" title="Remove"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
            {team.invitations.length > 0 && (
              <>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-6 mb-2">Pending invitations</h4>
                {team.invitations.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="flex-1 text-gray-600">{i.email}</span>
                    <Badge v="amber">{i.role} · pending</Badge>
                    {canManage && <button onClick={() => del(i.id, `the invitation for ${i.email}`)} className="p-1.5 rounded-lg text-red hover:bg-red-lt cursor-pointer" title="Revoke"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </>
            )}
          </Card>

          <Card>
            <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2"><UserPlus size={16} className="text-green" /> Invite someone</h3>
            {canManage ? (
              <div className="flex flex-col gap-3">
                <Input label="Email" type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Role</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
                    {['recruiter', 'viewer', ...(company?.role === 'owner' ? ['admin'] : [])].map((r) => <option key={r} value={r}>{r} — {ROLE_HELP[r]}</option>)}
                  </select>
                </div>
                <Btn v="primary" loading={invite.isPending} disabled={!email.trim()} onClick={send}>Send invitation</Btn>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Only owners and admins can invite people.</p>
            )}
          </Card>
        </div>
      )}
    </EmployerShell>
  );
}
