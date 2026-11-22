// src/api/admin/adminApi.ts
// Adapter between the admin pages (view models) and the NestJS backend (Prisma shapes).
// Admin settings groups are persisted in the backend's generic JSON columns / PlatformSetting store.
// Features without a backend endpoint (plans, token usage, deletion requests) return defaults or empty data.
import http from '@/lib/http';

type Res = Promise<{ data: any }>;
type Id = string | number;
const wrap = (data: unknown) => ({ data });
const unsupported = async (what: string): Res => {
  throw { response: { status: 501, data: { detail: `${what} is not available on this backend yet.` } } };
};

const DAY = 86_400_000;
const within = (iso: string, days: number) => Date.now() - +new Date(iso) <= days * DAY;
const get = async <T = any[]>(url: string, params?: Record<string, unknown>): Promise<T> => (await http.get(url, { params })).data;
const lower = (v: unknown) => String(v ?? '').toLowerCase();

const toRole = (r: string) => (r.endsWith('ADMIN') ? 'admin' : lower(r));

/* ── Overview ───────────────────────────────────────────────── */
export const getOverview = async (): Res => {
  const [users, employers, jobs, flags, disputes, payroll] = await Promise.all([
    get('/admin/users'), get('/admin/employers'), get('/admin/jobs'), get('/admin/compliance'),
    get('/admin/billing/disputes'), get('/admin/payroll'),
  ]);
  const candidates = users.filter((u) => u.role === 'CANDIDATE');
  return wrap({
    candidates: candidates.length,
    newCandidates7d: candidates.filter((u) => within(u.createdAt, 7)).length,
    employers: employers.length,
    newEmployers30d: employers.filter((e) => within(e.createdAt, 30)).length,
    interviews30d: 0, interviewsChangePct: null,
    gmv30d: payroll.filter((p: any) => within(p.createdAt, 30)).reduce((s: number, p: any) => s + p.gross, 0),
    gmvChangePct: null,
    activeJobs: jobs.filter((j) => j.status === 'ACTIVE').length,
    applications: 0,
    openFlags: flags.filter((f) => f.status === 'FLAGGED').length,
    openDisputes: disputes.filter((d: any) => d.status === 'FLAGGED').length,
    pendingDeletions: 0,
    pendingKyc: employers.filter((e) => e.kycStatus === 'PENDING').length,
  });
};

/* ── Users ──────────────────────────────────────────────────── */
const toAdminUser = (u: any) => ({
  id: u.id, name: u.fullName, username: null, email: u.email, role: toRole(u.role),
  status: u.isActive ? 'active' : 'suspended', created_at: u.createdAt, last_login_at: null, ai_score: null, company: null,
});

export const getUsers = async (params?: Record<string, unknown>): Res => {
  const role = params?.role ? String(params.role).toUpperCase() : undefined;
  const search = params?.q ?? params?.search;
  const rows = await get('/admin/users', {
    ...(role && role !== 'ADMIN' ? { role } : {}),
    ...(search ? { search: String(search) } : {}),
  });
  const wantedRole = params?.role ? lower(params.role) : null;
  const users = rows.map(toAdminUser)
    .filter((u) => !params?.status || u.status === params.status)
    .filter((u) => !wantedRole || u.role === wantedRole);
  return wrap({ total: users.length, results: users });
};

export const getUserDetail = async (id: Id): Res => {
  const u = (await get('/admin/users')).find((x) => x.id === String(id));
  if (!u) throw { response: { status: 404, data: { detail: 'User not found.' } } };
  return wrap(toAdminUser(u));
};

export const setUserStatus = (id: Id, status: 'active' | 'suspended'): Res =>
  http.patch(`/admin/users/${id}/access`, { isActive: status === 'active' });

export const exportUsers = async (params?: Record<string, unknown>): Promise<{ data: Blob }> => {
  const { data } = await getUsers(params);
  const rows = (data.results as ReturnType<typeof toAdminUser>[]).map((u) => [u.name, u.email, u.role, u.status, u.created_at]);
  const csv = [['Name', 'Email', 'Role', 'Status', 'Created'], ...rows]
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  return { data: new Blob([csv], { type: 'text/csv' }) };
};

/* ── Employers ──────────────────────────────────────────────── */
export const getEmployers = async (_params?: Record<string, unknown>): Res => {
  const [employers, jobs] = await Promise.all([get('/admin/employers'), get('/admin/jobs')]);
  return wrap(employers.map((e) => ({
    id: e.id, name: e.companyName ?? e.user?.fullName ?? 'Unnamed company', industry: e.industry, headquarters: e.headquarters,
    plan: lower(e.plan), kyc_status: lower(e.kycStatus), created_at: e.createdAt,
    active_roles: jobs.filter((j) => j.employerId === e.id && j.status === 'ACTIVE').length, members: 1,
  })));
};

export const updateKyc = (id: Id, status: string, _notes?: string): Res =>
  http.patch(`/admin/employers/${id}/kyc`, { kycStatus: status.toUpperCase() });
export const updateEmployerPlan = (_id: Id, _plan: string): Res => unsupported('Changing an employer plan');

/* ── Jobs ───────────────────────────────────────────────────── */
const MODERATION: Record<string, 'approved' | 'flagged' | 'removed'> = { ACTIVE: 'approved', DRAFT: 'approved', PAUSED: 'flagged', CLOSED: 'removed' };
export const getJobListings = async (_params?: Record<string, unknown>): Res => {
  const jobs = await get('/admin/jobs');
  return wrap({
    stats: { activeListings: jobs.filter((j) => j.status === 'ACTIVE').length, totalApplications: 0, filled30d: 0 },
    jobs: jobs.map((j) => ({
      id: j.id, title: j.title, company_name: j.employer?.companyName ?? '', status: lower(j.status),
      moderation_status: MODERATION[j.status] ?? 'approved', moderation_note: null, posted_at: j.createdAt, applicants: 0,
    })),
  });
};

export const moderateJob = (id: Id, action: string, _note?: string): Res => {
  const a = lower(action);
  const status = a.startsWith('approv') || a === 'restore' ? 'ACTIVE' : a.startsWith('remov') || a === 'close' ? 'CLOSED' : 'PAUSED';
  return http.patch(`/admin/jobs/${id}/status`, { status });
};

/* ── Settings groups (stored as JSON in the backend's config tables) ── */
const INTERVIEW_DEFAULTS = {
  questionsPerRole: 8, maxDurationMinutes: 45, maxAnswerMinutes: 3, aiToolDetection: true,
  recordingRetentionDays: 90, retakePolicy: 'one_attempt', practiceMode: true,
};
const SCORING_DEFAULTS = {
  weights: { technical_depth: 35, communication: 25, system_design: 20, problem_solving: 20 },
  tiers: [
    { tier: 'A', min: 85, label: 'Top candidate', visibility: 'Featured to employers' },
    { tier: 'B', min: 70, label: 'Strong', visibility: 'Visible to employers' },
    { tier: 'C', min: 0, label: 'Developing', visibility: 'Limited visibility' },
  ],
};
const LLM_DEFAULTS = {
  model: 'gemini-3.1-flash-lite', fallbackModel: '', temperature: 0.2, maxTokens: 1024, contextWindow: 8192, monthlyTokenBudget: 1_000_000, systemPrompt: '',
};

export const getInterviewConfig = async (): Res => {
  const cfg = (await get('/admin/interview-config')).find((c) => c.isDefault) ?? (await get('/admin/interview-config'))[0];
  return wrap({ ...INTERVIEW_DEFAULTS, ...(cfg?.rubric?.settings ?? {}) });
};
export const updateInterviewConfig = async (c: Record<string, unknown>): Res => {
  const list = await get('/admin/interview-config');
  const cur = list.find((x) => x.isDefault) ?? list[0];
  const body = {
    name: cur?.name ?? 'Default interview config',
    questionSet: cur?.questionSet ?? { questions: [] },
    rubric: { ...(cur?.rubric ?? {}), settings: c },
    isDefault: true,
  };
  return cur ? http.patch(`/admin/interview-config/${cur.id}`, body) : http.post('/admin/interview-config', body);
};

export const getScoringModel = async (): Res => {
  const m = (await get('/admin/scoring-model')).find((x) => x.isActive);
  return wrap({ ...SCORING_DEFAULTS, ...(m ? { weights: m.weights } : {}) });
};
export const updateScoringModel = async (m: Record<string, unknown>): Res => {
  const cur = (await get('/admin/scoring-model')).find((x) => x.isActive);
  const body = { name: cur?.name ?? 'Default scoring model', weights: m.weights ?? SCORING_DEFAULTS.weights, isActive: true };
  return cur ? http.patch(`/admin/scoring-model/${cur.id}`, body) : http.post('/admin/scoring-model', body);
};

export const getLlmSettings = async (): Res => {
  const s = (await get('/admin/llm-settings')).find((x) => x.isActive);
  return wrap({ ...LLM_DEFAULTS, ...(s?.config ?? {}), ...(s ? { model: s.model, systemPrompt: s.promptTemplate ?? '' } : {}) });
};
export const updateLlmSettings = async (s: Record<string, unknown>): Res => {
  const cur = (await get('/admin/llm-settings')).find((x) => x.isActive);
  const { model, systemPrompt, ...config } = s as Record<string, any>;
  const body = {
    provider: cur?.provider ?? 'gemini', endpoint: cur?.endpoint ?? 'https://generativelanguage.googleapis.com',
    model: model ?? cur?.model ?? LLM_DEFAULTS.model, promptTemplate: systemPrompt ?? '', config, isActive: true,
  };
  return cur ? http.patch(`/admin/llm-settings/${cur.id}`, body) : http.post('/admin/llm-settings', body);
};
export const getTokenUsage = async (): Res =>
  wrap({ usedThisMonth: 0, calls: 0, budget: LLM_DEFAULTS.monthlyTokenBudget, percentUsed: 0, apiKeyConfigured: false, byPurpose: [], byDay: [] });

const SETTINGS_DEFAULTS = {
  platformName: 'Humiq Loop', currency: 'USD', commissionPercent: 10, trialDays: 14, maintenanceMode: false, emailNotifications: true, adminTwoFactor: false,
};
export const getSettings = async (): Res => {
  const rows = await get('/admin/settings');
  return wrap({ ...SETTINGS_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) });
};
export const updateSettings = async (s: Record<string, unknown>): Res => {
  await Promise.all(Object.entries(s).map(([key, value]) => http.post('/admin/settings', { key, value })));
  return getSettings();
};
export const getPlans = async (): Res => wrap([]);
export const updatePlan = (_code: string, _data: Record<string, unknown>): Res => unsupported('Editing plans');

/* ── Compliance flags (shown as flagged interviews) ─────────── */
export const getFlagged = async (status = 'open'): Res => {
  const flags = await get('/admin/compliance');
  const open = status === 'open';
  return wrap(flags.filter((f) => (f.status === 'FLAGGED') === open).map((f) => ({
    id: f.id, reason: f.type, severity: 'medium', details: f.notes, status: open ? 'open' : lower(f.status),
    created_at: f.createdAt, candidate: '', job_title: null,
  })));
};
export const resolveFlag = (id: Id, _resolution: 'resolved' | 'dismissed', note?: string): Res =>
  http.patch(`/admin/compliance/${id}/resolve`, note ? { notes: note } : {});

/* ── Payroll & billing ──────────────────────────────────────── */
export const getTransactions = async (_params?: Record<string, unknown>): Res => {
  const [entries, disputes] = await Promise.all([get('/admin/payroll'), get('/admin/billing/disputes')]);
  const disputed = new Set(disputes.map((d: any) => d.payrollEntryId));
  const recent = entries.filter((e) => within(e.createdAt, 30));
  const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0);
  return wrap({
    summary: {
      gmv30d: sum(recent, (e) => e.gross),
      pendingPayouts: sum(entries.filter((e) => e.status === 'PENDING' || e.status === 'PROCESSING'), (e) => e.net),
      feesCollected: sum(entries.filter((e) => e.status === 'PAID'), (e) => e.gross - e.net),
      openDisputes: disputes.filter((d: any) => d.status === 'FLAGGED').length,
    },
    transactions: entries.map((e) => ({
      id: e.id, invoice_number: e.invoiceNumber ?? '', period_end: e.periodEnd ?? e.createdAt, gross_amount: e.gross,
      fee_amount: e.gross - e.net, net_amount: e.net, status: lower(e.status),
      employer: e.employer?.companyName ?? '', candidate: e.candidate?.userId ?? '', disputed: disputed.has(e.id),
    })),
  });
};

export const processPayroll = async (): Res => {
  const { data } = await http.post('/admin/payroll/run');
  const rows: any[] = Array.isArray(data) ? data : [];
  return wrap({ payments: rows.length, totalNet: rows.reduce((s, r) => s + (r?.net ?? 0), 0) });
};

export const getDisputes = async (status = 'open'): Res => {
  const rows = await get('/admin/billing/disputes');
  const open = status === 'open';
  return wrap(rows.filter((d) => (d.status === 'FLAGGED') === open).map((d) => ({
    id: d.id, reason: d.reason ?? '', invoice_number: d.payrollEntry?.invoiceNumber ?? '',
    gross_amount: d.payrollEntry?.gross ?? 0, net_amount: d.payrollEntry?.net ?? 0,
    employer: d.employer?.companyName ?? '', candidate: '', created_at: d.createdAt,
  })));
};

export const resolveDispute = (id: Id, resolution: 'refunded' | 'rejected', note?: string): Res =>
  http.patch(`/admin/billing/disputes/${id}/resolve`, {
    resolution: resolution === 'refunded' ? 'REFUNDED' : 'RESOLVED', ...(note ? { notes: note } : {}),
  });

/* ── Compliance ─────────────────────────────────────────────── */
export const getCompliance = async (): Res => {
  const audit = await get('/admin/audit-log').catch(() => []);
  return wrap({
    summary: { pendingDeletions: 0, overdueDeletions: 0, auditEvents: audit.length },
    policies: [],
  });
};
export const getDeletions = async (_status = 'pending'): Res => wrap([]);
export const processDeletion = (_id: Id): Res => unsupported('Data-deletion requests');
export const getAuditTrail = async (params?: Record<string, unknown>): Res => {
  const rows = await get('/admin/audit-log', { limit: params?.pageSize ?? 100 }).catch(() => []);
  return wrap(rows.map((a) => ({
    id: a.id, action: a.action, entity_type: a.targetType ?? '', created_at: a.createdAt, actor: a.actor?.fullName ?? null, company: null,
  })));
};
