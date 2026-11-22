// src/components/ui/ai-interviews/ai-sessions-page.tsx
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronDown, CircleDot, Copy, Download, GripVertical, Settings, Trash2, Users } from 'lucide-react';
import { Alert, Badge, Btn, EmptyState, LoadingState, SearchBar } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { cn } from '@/lib/utils';
import { apiErrorMessage, useAiCandidates, useAiSessions, useDeleteSessions } from '@/api/aiInterviews/useAiInterviews';
import type { AiCandidate } from '@/api/aiInterviews/aiInterviewsApi';
import { copyText, fmtDuration, inviteUrl, overallScore, scoreTone, STATUS_BADGE } from './ai-bits';

interface Row {
  key: string;
  sessionId: string | null;
  name: string;
  email: string | null;
  interviewId: string;
  interviewTitle: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'ABANDONED' | 'NOT_STARTED';
  duration: number | null;
  messages: number;
  score: number | null;
  started: string | null;
  created: string;
  inviteToken: string | null;
  candidate: AiCandidate | null;
  phone: string | null;
}

/* ── Column definitions: the header and every cell come from the same entry, so they always line up ── */
interface Col {
  key: string;
  label: string;
  cell: (r: Row) => ReactNode;
  sort: (r: Row) => string | number | null;
  cls?: string;
}

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const text = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '—' : String(v));
const clip = 'block max-w-[16rem] truncate';

const COLS: Col[] = [
  { key: 'interview', label: 'Interview', sort: (r) => r.interviewTitle.toLowerCase(), cls: 'min-w-[14rem] font-semibold text-navy', cell: (r) => <span className="block max-w-[18rem] whitespace-normal leading-snug">{text(r.interviewTitle)}</span> },
  { key: 'name', label: 'Name', sort: (r) => r.name.toLowerCase(), cls: 'font-medium text-gray-800', cell: (r) => <span className={clip}>{r.name}</span> },
  { key: 'email', label: 'Email', sort: (r) => (r.email ?? '').toLowerCase(), cls: 'text-gray-600', cell: (r) => <span className={clip}>{text(r.email)}</span> },
  { key: 'phone', label: 'Phone', sort: (r) => r.phone ?? '', cls: 'text-gray-600', cell: (r) => text(r.phone) },
  { key: 'gender', label: 'Gender', sort: (r) => r.candidate?.gender ?? '', cls: 'text-gray-600', cell: (r) => text(r.candidate?.gender) },
  { key: 'birthday', label: 'Birthday', sort: (r) => r.candidate?.birthday ?? '', cls: 'text-gray-600', cell: (r) => text(r.candidate?.birthday) },
  { key: 'education', label: 'Education', sort: (r) => r.candidate?.education ?? '', cls: 'text-gray-600', cell: (r) => text(r.candidate?.education) },
  { key: 'school', label: 'School', sort: (r) => r.candidate?.school ?? '', cls: 'text-gray-600', cell: (r) => <span className={clip}>{text(r.candidate?.school)}</span> },
  { key: 'major', label: 'Major', sort: (r) => r.candidate?.major ?? '', cls: 'text-gray-600', cell: (r) => <span className={clip}>{text(r.candidate?.major)}</span> },
  { key: 'gradYear', label: 'Grad Year', sort: (r) => r.candidate?.graduationYear ?? null, cls: 'text-gray-600', cell: (r) => text(r.candidate?.graduationYear) },
  { key: 'experience', label: 'Experience', sort: (r) => r.candidate?.workExperience ?? '', cls: 'text-gray-600', cell: (r) => <span className={clip}>{text(r.candidate?.workExperience)}</span> },
  {
    key: 'status', label: 'Status', sort: (r) => r.status,
    cell: (r) => { const b = r.status === 'NOT_STARTED' ? { label: 'Not started', v: 'gray' as const } : STATUS_BADGE[r.status]; return <Badge v={b.v}>{b.label}</Badge>; },
  },
  {
    key: 'score', label: 'Score', sort: (r) => r.score,
    cell: (r) => (r.score != null ? <span className={cn('font-bold', scoreTone(r.score))}>{r.score.toFixed(1)}/10</span> : <span className="text-gray-400">—</span>),
  },
  { key: 'duration', label: 'Duration', sort: (r) => r.duration, cls: 'text-gray-600', cell: (r) => fmtDuration(r.duration) },
  { key: 'started', label: 'Started', sort: (r) => (r.started ? +new Date(r.started) : null), cls: 'text-gray-600 whitespace-nowrap', cell: (r) => dateTime(r.started) },
  { key: 'source', label: 'Source', sort: (r) => (r.candidate ? 'Invited' : 'Walk-in'), cell: (r) => <Badge v={r.candidate ? 'blue' : 'gray'}>{r.candidate ? 'Invited' : 'Walk-in'}</Badge> },
  { key: 'created', label: 'Created', sort: (r) => +new Date(r.created), cls: 'text-gray-600 whitespace-nowrap', cell: (r) => dateTime(r.created) },
];

/** Plain-text value of a cell, used for CSV export. */
function plainValue(key: string, r: Row): string {
  const c = r.candidate;
  switch (key) {
    case 'interview': return r.interviewTitle;
    case 'name': return r.name;
    case 'email': return r.email ?? '';
    case 'phone': return r.phone ?? '';
    case 'gender': return c?.gender ?? '';
    case 'birthday': return c?.birthday ?? '';
    case 'education': return c?.education ?? '';
    case 'school': return c?.school ?? '';
    case 'major': return c?.major ?? '';
    case 'gradYear': return c?.graduationYear != null ? String(c.graduationYear) : '';
    case 'experience': return c?.workExperience ?? '';
    case 'status': return r.status === 'NOT_STARTED' ? 'Not started' : STATUS_BADGE[r.status]?.label ?? r.status;
    case 'score': return r.score != null ? `${r.score.toFixed(1)}/10` : '';
    case 'duration': return r.duration ? fmtDuration(r.duration) : '';
    case 'started': return r.started ? new Date(r.started).toISOString() : '';
    case 'source': return r.candidate ? 'Invited' : 'Walk-in';
    case 'created': return new Date(r.created).toISOString();
    default: return '';
  }
}

// Quote every cell, and neutralise values a spreadsheet could run as a formula (names/emails are user-supplied).
const csvCell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

/** Filter dropdown with a leading icon; the select keeps native behaviour so it stays keyboard/screen-reader friendly. */
function FilterSelect({ icon, value, onChange, label, className, children }: { icon: ReactNode; value: string; onChange: (v: string) => void; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">{icon}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="h-[42px] w-full appearance-none rounded-xl border border-gray-200 bg-white pl-10 pr-9 text-sm text-gray-800 outline-none transition-all focus:border-green focus:ring-2 focus:ring-green/20">
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
    </div>
  );
}

const RANGES = [
  { value: '', label: 'All Time', days: 0 },
  { value: '1', label: 'Today', days: 1 },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
];

const ALL_KEYS = COLS.map((c) => c.key);
const DEFAULT_VISIBLE = ['interview', 'name', 'email', 'status', 'score', 'duration', 'started', 'source', 'created'];
const STORE = 'talentai-sessions-columns-v1';
interface Prefs { order: string[]; visible: string[] }

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Prefs | null;
    if (p && Array.isArray(p.order) && Array.isArray(p.visible)) {
      const visible = p.visible.filter((k) => ALL_KEYS.includes(k));
      if (visible.length) return { order: [...p.order.filter((k) => ALL_KEYS.includes(k)), ...ALL_KEYS.filter((k) => !p.order.includes(k))], visible };
    }
  } catch { /* storage unavailable or corrupt: use defaults */ }
  return { order: ALL_KEYS, visible: DEFAULT_VISIBLE };
}

/** Sidebar "Sessions": every invited candidate and every session across all of the employer's interviews. */
export function AiSessionsPage() {
  const navigate = useNavigate();
  const sessions = useAiSessions();
  const candidates = useAiCandidates();
  const remove = useDeleteSessions();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'created', dir: 'desc' });
  const dragKey = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const toggleCol = (key: string) => {
    const on = prefs.visible.includes(key);
    if (on && prefs.visible.length === 1) return; // always keep at least one column
    savePrefs({ ...prefs, visible: on ? prefs.visible.filter((k) => k !== key) : [...prefs.visible, key] });
  };
  const dropCol = (target: string) => {
    const from = dragKey.current;
    dragKey.current = null;
    setDragOver(null);
    if (!from || from === target) return;
    const order = prefs.order.filter((k) => k !== from);
    order.splice(order.indexOf(target), 0, from);
    savePrefs({ ...prefs, order });
  };
  const columns = prefs.order.filter((k) => prefs.visible.includes(k)).map((k) => COLS.find((c) => c.key === k)!);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const byCandidateSession = new Map((candidates.data?.candidates ?? []).filter((c) => c.sessionId).map((c) => [c.sessionId!, c]));
    for (const s of sessions.data?.sessions ?? []) {
      const cand = byCandidateSession.get(s.id) ?? null;
      out.push({
        key: s.id, sessionId: s.id, name: s.participantName || s.participantEmail || 'Anonymous', email: s.participantEmail,
        interviewId: s.interviewId, interviewTitle: s.interview?.title ?? '', status: s.status, duration: s.totalDurationSeconds,
        messages: s._count?.messages ?? 0, score: overallScore(s.insights), started: s.startedAt, created: cand?.createdAt ?? s.createdAt,
        inviteToken: cand?.inviteToken ?? null, candidate: cand, phone: cand?.phone ?? null,
      });
    }
    for (const c of candidates.data?.candidates ?? []) {
      if (c.sessionId) continue;
      out.push({
        key: `c-${c.id}`, sessionId: null, name: c.name, email: c.email, interviewId: c.interviewId, interviewTitle: c.interview?.title ?? '',
        status: 'NOT_STARTED', duration: null, messages: 0, score: null, started: null, created: c.createdAt, inviteToken: c.inviteToken,
        candidate: c, phone: c.phone,
      });
    }
    return out;
  }, [sessions.data, candidates.data]);

  const q = query.toLowerCase();
  const visible = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key) ?? COLS[0];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const days = Number(range) || 0;
    // "Today" starts at local midnight; the other ranges are a rolling window of N days.
    const since = days === 1 ? new Date().setHours(0, 0, 0, 0) : days ? Date.now() - days * 86_400_000 : 0;
    return rows
      .filter((r) => (!since || +new Date(r.created) >= since) && (!status || r.status === status) && (!q || `${r.name} ${r.email ?? ''} ${r.interviewTitle}`.toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = col.sort(a);
        const y = col.sort(b);
        if (x === null && y === null) return 0;
        if (x === null) return 1; // empty values always sink to the bottom
        if (y === null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * dir;
      });
  }, [rows, status, range, q, sort]);

  // Exports what you see: the filtered rows (or just the ticked ones) in the visible columns and order.
  const exportCsv = () => {
    const chosen = selected.length ? visible.filter((r) => r.sessionId && selected.includes(r.sessionId)) : visible;
    const lines = [columns.map((c) => csvCell(c.label)).join(','), ...chosen.map((r) => columns.map((c) => csvCell(plainValue(c.key, r))).join(','))];
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ ok: true, text: `Exported ${chosen.length} session${chosen.length === 1 ? '' : 's'}.` });
  };

  const selectable = visible.filter((r) => r.sessionId).map((r) => r.sessionId!);
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.includes(id));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const loading = sessions.isLoading || candidates.isLoading;
  const error = sessions.error ?? candidates.error;

  return (
    <EmployerShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy">Sessions</h1>
          <p className="text-sm text-gray-400 mt-0.5">Every candidate invited to your AI interviews, and how they got on</p>
        </div>
        {selected.length > 0 && (
          <Btn v="outline" icon={<Trash2 size={14} />} loading={remove.isPending}
            onClick={() => window.confirm(`Delete ${selected.length} session(s)?`) &&
              remove.mutateAsync(selected).then(() => setSelected([])).catch((e) => setMsg({ ok: false, text: apiErrorMessage(e) }))}>
            Delete {selected.length}
          </Btn>
        )}
      </div>

      {msg && <div className="mb-4"><Alert v={msg.ok ? 'success' : 'error'}>{msg.text}</Alert></div>}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-[14rem]"><SearchBar value={query} onChange={setQuery} placeholder="Search name, email or interview…" /></div>
        <FilterSelect icon={<CalendarDays size={16} />} value={range} onChange={setRange} label="Filter by date created" className="w-44">
          {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </FilterSelect>
        <FilterSelect icon={<CircleDot size={16} />} value={status} onChange={setStatus} label="Filter by status" className="w-48">
          <option value="">All Status</option><option value="COMPLETED">Completed</option><option value="IN_PROGRESS">In progress</option>
          <option value="NOT_STARTED">Not started</option><option value="ABANDONED">Abandoned</option>
        </FilterSelect>
        <Btn v="outline" className="h-[42px]" icon={<Download size={15} />} disabled={visible.length === 0} onClick={exportCsv}>Export</Btn>
      </div>

      {loading && <LoadingState msg="Loading sessions…" />}
      {error && <Alert v="error">{apiErrorMessage(error, 'Could not load sessions. Is the backend running?')}</Alert>}
      {!loading && !error && visible.length === 0 && (
        <EmptyState icon={<Users size={36} />} title="No sessions" body={rows.length ? 'No sessions match your filters.' : 'Invite candidates to one of your interviews to see them here.'}
          action={!rows.length ? <Btn v="primary" onClick={() => navigate({ to: '/employer/ai/interviews' })}>Go to interviews</Btn> : undefined} />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-10 px-4 py-3 text-left align-middle">
                  <input type="checkbox" className="h-4 w-4 accent-green" checked={allSelected} aria-label="Select all sessions"
                    onChange={() => setSelected(allSelected ? selected.filter((id) => !selectable.includes(id)) : [...new Set([...selected, ...selectable])])} />
                </th>
                {columns.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th key={c.key} className="px-3 py-3 text-left align-middle" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className={cn('inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold hover:text-navy', active ? 'text-navy' : 'text-gray-600')}
                        onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
                        {c.label}
                        {active && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </button>
                    </th>
                  );
                })}
                {/* Pinned to the right edge so the gear stays visible however many columns are shown */}
                <th className="sticky right-0 z-10 w-14 bg-gray-50 px-2 py-3 text-center align-middle shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]">
                  {/* modal={false}: no scroll-lock, so the page does not shift sideways when the menu opens */}
                  <DropdownMenu.Root modal={false}>
                    <DropdownMenu.Trigger asChild>
                      <button type="button" aria-label="Choose columns" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-200/70 hover:text-navy data-[state=open]:bg-gray-200/70 data-[state=open]:text-navy">
                        <Settings size={16} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content align="end" sideOffset={6} className="z-50 max-h-80 w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
                        <div className="px-2 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Columns</div>
                        {prefs.order.map((k) => {
                          const c = COLS.find((x) => x.key === k)!;
                          const on = prefs.visible.includes(k);
                          return (
                            <DropdownMenu.CheckboxItem key={k} checked={on} draggable
                              onSelect={(e) => e.preventDefault()} onCheckedChange={() => toggleCol(k)}
                              onDragStart={() => { dragKey.current = k; }} onDragOver={(e) => { e.preventDefault(); setDragOver(k); }}
                              onDragLeave={() => setDragOver((d) => (d === k ? null : d))} onDrop={(e) => { e.preventDefault(); dropCol(k); }}
                              onDragEnd={() => { dragKey.current = null; setDragOver(null); }}
                              className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-gray-100',
                                dragOver === k && dragKey.current !== k && 'bg-green-xlt ring-1 ring-green/40', on ? 'text-navy' : 'text-gray-600')}>
                              <GripVertical size={14} className="flex-shrink-0 cursor-grab text-gray-300" />
                              <span className="flex-1">{c.label}</span>
                              {on && <Check size={15} className="text-green" />}
                            </DropdownMenu.CheckboxItem>
                          );
                        })}
                        <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
                        <DropdownMenu.Item className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-500 outline-none data-[highlighted]:bg-gray-100 data-[highlighted]:text-navy"
                          onSelect={(e) => { e.preventDefault(); savePrefs({ order: ALL_KEYS, visible: DEFAULT_VISIBLE }); }}>
                          Reset to default
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((r) => {
                const open = () => r.sessionId && navigate({ to: '/employer/ai/sessions/$sessionId', params: { sessionId: r.sessionId } });
                return (
                  <tr key={r.key} className={cn('group transition-colors', r.sessionId ? 'cursor-pointer hover:bg-gray-50' : '')} onClick={open}>
                    <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                      {r.sessionId
                        ? <input type="checkbox" className="h-4 w-4 accent-green" checked={selected.includes(r.sessionId)} onChange={() => toggle(r.sessionId!)} aria-label={`Select ${r.name}`} />
                        : <span className="block w-4" />}
                    </td>
                    {columns.map((c) => <td key={c.key} className={cn('px-3 py-3 align-middle', c.cls)}>{c.cell(r)}</td>)}
                    {/* Same width and pinned edge as the gear above, so the icons line up in one column */}
                    <td className={cn('sticky right-0 w-14 bg-white px-2 py-3 text-center align-middle shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]', r.sessionId && 'group-hover:bg-gray-50')} onClick={(e) => e.stopPropagation()}>
                      {r.inviteToken && r.status !== 'COMPLETED' && (
                        <button type="button" aria-label={`Copy invite link for ${r.name}`} title="Copy invite link"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-green hover:text-green-dk"
                          onClick={async () => setMsg({ ok: true, text: (await copyText(inviteUrl(r.inviteToken!))) ? `Invite link for ${r.name} copied.` : inviteUrl(r.inviteToken!) })}>
                          <Copy size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </EmployerShell>
  );
}
