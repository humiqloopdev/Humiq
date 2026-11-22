// src/components/ui/candidate/applications-page.tsx
import { useState } from 'react';
import {
  Briefcase, Clock, CheckCircle2, XCircle, Eye, ChevronRight, Calendar,
} from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, LoadingState, MetricCard } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import {
  apiErrorMessage, useApplications, useInvitations, useOffers, useRespondInvitation, useRespondOffer, useWithdrawApplication,
} from '@/api/candidate/useCandidateQueries';
import type { BadgeVariant } from '@/types';
import { formatShortDate, initials, timeAgo } from '@/lib/utils';


const STATUS: Record<string, { label: string; badge: BadgeVariant; icon: React.ReactNode }> = {
  applied: { label: 'Applied', badge: 'amber', icon: <Clock size={14} className="text-amber" /> },
  in_review: { label: 'In Review', badge: 'amber', icon: <Clock size={14} className="text-amber" /> },
  shortlisted: { label: 'Shortlisted', badge: 'green', icon: <CheckCircle2 size={14} className="text-green" /> },
  interviewed: { label: 'Interviewed', badge: 'blue', icon: <CheckCircle2 size={14} className="text-blue" /> },
  interview_scheduled: { label: 'Interview Scheduled', badge: 'blue', icon: <Calendar size={14} className="text-blue" /> },
  offer_received: { label: 'Offer Received', badge: 'purple', icon: <CheckCircle2 size={14} className="text-purple" /> },
  accepted: { label: 'Accepted', badge: 'green', icon: <CheckCircle2 size={14} className="text-green" /> },
  rejected: { label: 'Rejected', badge: 'red', icon: <XCircle size={14} className="text-red" /> },
  withdrawn: { label: 'Withdrawn', badge: 'gray', icon: <XCircle size={14} className="text-gray-400" /> },
};

const CLOSED = ['rejected', 'withdrawn'];
const WITHDRAWABLE = ['applied', 'in_review', 'shortlisted', 'interview_scheduled', 'interviewed'];

export function ApplicationsPage() {
  const [filter, setFilter] = useState<'All' | 'Active' | 'Closed'>('All');
  const [error, setError] = useState('');
  const { data: apps = [], isLoading, isError } = useApplications();
  const withdraw = useWithdrawApplication();
  const { data: invitations = [] } = useInvitations();
  const { data: offers = [] } = useOffers();
  const respondInvite = useRespondInvitation();
  const respondOffer = useRespondOffer();
  const pendingInvites = invitations.filter((i) => i.status === 'pending');
  const openOffers = offers.filter((o) => o.status === 'sent');

  const respond = (p: Promise<unknown>) => p.then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));

  const filtered = apps.filter((a) => {
    if (filter === 'Active') return !CLOSED.includes(a.status);
    if (filter === 'Closed') return CLOSED.includes(a.status);
    return true;
  });

  const count = (status: string) => apps.filter((a) => a.status === status).length;
  const active = apps.filter((a) => !CLOSED.includes(a.status)).length;

  const metrics = [
    { icon: <Briefcase size={20} />, value: String(active), label: 'Active Applications', delta: `${apps.length} total`, up: true, accent: 'blue' as const },
    { icon: <CheckCircle2 size={20} />, value: String(count('shortlisted')), label: 'Shortlisted', delta: 'Under review', up: true, accent: 'green' as const },
    { icon: <Calendar size={20} />, value: String(count('interview_scheduled')), label: 'Interviews Scheduled', delta: 'Upcoming', up: true, accent: 'purple' as const },
    { icon: <Eye size={20} />, value: String(count('offer_received')), label: 'Offers Received', delta: count('offer_received') ? 'Action needed!' : 'None yet', up: true, accent: 'amber' as const },
  ];

  const onWithdraw = (id: string, title: string) => {
    if (!window.confirm(`Withdraw your application for "${title}"?`)) return;
    withdraw.mutateAsync(id).then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  };

  return (
    <CandidateShell>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">My Applications</h1>
        <p className="text-sm text-gray-400 mt-0.5">Track every role you've applied to</p>
      </div>

      {isLoading && <LoadingState msg="Loading applications…" />}
      {isError && <Alert v="error">Could not load applications. Is the backend running?</Alert>}
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          {openOffers.map((o) => (
            <div key={o.id} className="bg-purple-lt border border-purple rounded-2xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <CheckCircle2 size={18} className="text-purple flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-purple text-sm">Offer from {o.company_name}: ${o.hourly_rate}/hr</div>
                <div className="text-xs text-purple mt-0.5">
                  {o.title} · starts {formatShortDate(o.start_date)} · respond by {formatShortDate(o.expires_at)}
                  {o.message ? ` · "${o.message}"` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <Btn v="navy" sz="sm" loading={respondOffer.isPending && respondOffer.variables?.id === o.id}
                  onClick={() => respond(respondOffer.mutateAsync({ id: o.id, accept: true }))}>Accept</Btn>
                <Btn v="outline" sz="sm" disabled={respondOffer.isPending}
                  onClick={() => window.confirm('Decline this offer?') && respond(respondOffer.mutateAsync({ id: o.id, accept: false }))}>Decline</Btn>
              </div>
            </div>
          ))}

          {pendingInvites.map((i) => (
            <div key={i.id} className="bg-blue-lt border border-blue rounded-2xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <Calendar size={18} className="text-blue flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-blue text-sm">Interview invitation from {i.company_name}</div>
                <div className="text-xs text-blue mt-0.5">
                  {i.title}{i.message ? ` · "${i.message}"` : ''} · respond by {formatShortDate(i.expires_at)}
                </div>
              </div>
              <div className="flex gap-2">
                <Btn v="navy" sz="sm" loading={respondInvite.isPending && respondInvite.variables?.id === i.id}
                  onClick={() => respond(respondInvite.mutateAsync({ id: i.id, accept: true }))}>Accept</Btn>
                <Btn v="outline" sz="sm" disabled={respondInvite.isPending}
                  onClick={() => respond(respondInvite.mutateAsync({ id: i.id, accept: false }))}>Decline</Btn>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mb-5">
            {(['All', 'Active', 'Closed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-navy hover:text-navy'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {filtered.map((app) => {
              const s = STATUS[app.status] ?? STATUS.applied;
              return (
                <Card key={app.id} hover>
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-navy-lt flex items-center justify-center font-display font-extrabold text-navy text-sm flex-shrink-0">
                      {initials(app.company_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-display font-bold text-navy">{app.title}</span>
                        <div className="flex items-center gap-1">
                          {s.icon}
                          <Badge v={s.badge}>{s.label}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                        <span className="font-semibold text-gray-700">{app.company_name}</span>
                        <span className="flex items-center gap-1"><Clock size={11} />Applied {formatShortDate(app.applied_at)}</span>
                        {app.match_score != null && <span>{app.match_score}% match</span>}
                      </div>
                      <div className="text-xs text-gray-400">Updated {timeAgo(app.status_changed_at)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <ChevronRight size={16} className="text-gray-300" />
                      {WITHDRAWABLE.includes(app.status) && (
                        <Btn v="ghost" sz="sm" loading={withdraw.isPending && withdraw.variables === app.id} onClick={() => onWithdraw(app.id, app.title)}>
                          Withdraw
                        </Btn>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <EmptyState icon={<Briefcase size={36} />} title="No applications here" body="Apply to roles from Job Discovery." />
          )}
        </>
      )}
    </CandidateShell>
  );
}
