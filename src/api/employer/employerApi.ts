// src/api/employer/employerApi.ts
// Adapter between the employer pages (view models) and the NestJS backend (Prisma shapes).
// Features without a backend endpoint (notes, offers, interview invites, AI search, interview results,
// saved candidates) return empty data or a clear "not available" error.
import http from '@/lib/http';

type Res = Promise<{ data: any }>;
type Id = string;
const wrap = (data: unknown) => ({ data });
const unsupported = async (what: string): Res => {
  throw { response: { status: 501, data: { detail: `${what} is not available on this backend yet.` } } };
};

const COMMITMENT_LABEL: Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', FREELANCE: 'Freelance' };
const rawJobs = async (): Promise<any[]> => (await http.get('/employers/me/jobs')).data;
/** Backend groups applications by status; flatten to a list. */
const rawApplications = async (): Promise<any[]> => Object.values((await http.get('/employers/me/pipeline')).data as Record<string, any[]>).flat();

/** Backend scores may be 0-1 fractions; the UI shows 0-100. */
const pct = (v: number | null | undefined): number | null => (v == null ? null : Math.round(v <= 1 ? v * 100 : v));

const toEmpJob = (j: any, apps: any[] = []): any => {
  const mine = apps.filter((a) => a.jobId === j.id);
  return {
    id: j.id,
    title: j.title,
    role_type: j.roleType ?? null,
    commitment: COMMITMENT_LABEL[j.commitmentType] ?? null,
    rate_from: j.rateFrom,
    rate_to: j.rateTo,
    experience_level: j.experienceLevel ? String(j.experienceLevel).toLowerCase() : null,
    description: j.description ?? null,
    location: null,
    status: String(j.status).toLowerCase(),
    posted_at: j.createdAt,
    skills: j.requiredSkills ?? [],
    applicants: mine.length,
    shortlisted: mine.filter((a) => a.status === 'SHORTLISTED').length,
    views: 0,
  };
};

const toPipelineApp = (a: any) => ({
  id: a.id,
  status: String(a.status).toLowerCase(),
  stage: String(a.status).toLowerCase(),
  matchScore: pct(a.aiMatchScore),
  source: 'platform',
  appliedAt: a.appliedAt,
  statusChangedAt: a.updatedAt,
  job: { id: a.jobId, title: a.job?.title ?? '' },
  candidate: {
    id: a.candidateId,
    name: a.candidate?.user?.fullName ?? 'Candidate',
    role: a.candidate?.primaryRole ?? null,
    experience: a.candidate?.experienceLevel ? String(a.candidate.experienceLevel).toLowerCase() : null,
    location: null,
    aiScore: pct(a.aiMatchScore),
  },
});

/* ── Company ────────────────────────────────────────────────── */
export const getProfile = async (): Res => {
  const { data: p } = await http.get('/employers/me');
  return wrap({
    id: p.id,
    companyName: p.companyName ?? undefined,
    website: p.website, industry: p.industry, headquarters: p.headquarters, size: p.companySize, description: p.description,
    plan: String(p.plan).toLowerCase(), trialEndsAt: p.trialEndsAt, billingEmail: p.billingEmail,
    role: 'owner',
    onboardingStep: p.onboardingStep, onboardingCompleted: p.onboardingCompleted,
  });
};

export const updateProfile = async (data: Record<string, unknown>): Res => {
  const d = data as Record<string, any>;
  if (d.plan !== undefined || d.billingEmail !== undefined) {
    return wrap((await http.patch('/employers/me/onboarding/step2', {
      plan: String(d.plan ?? 'starter').toUpperCase(), billingEmail: d.billingEmail,
    })).data);
  }
  const { size, ...rest } = d;
  const allowed = ['companyName', 'website', 'industry', 'headquarters', 'description', 'logoUrl'];
  const body: Record<string, unknown> = { companySize: size };
  for (const k of allowed) if (rest[k]) body[k] = rest[k];
  if (!body.companySize) delete body.companySize;
  return wrap((await http.patch('/employers/me/onboarding/step1', body)).data);
};

/* ── Jobs ───────────────────────────────────────────────────── */
export const getJobs = async (params?: Record<string, unknown>): Res => {
  const [jobs, apps] = await Promise.all([rawJobs(), rawApplications().catch(() => [])]);
  const status = params?.status ? String(params.status).toLowerCase() : null;
  return wrap(jobs.map((j) => toEmpJob(j, apps)).filter((j) => !status || j.status === status));
};

export const getJobDetail = async (id: Id): Res => {
  const [jobs, apps] = await Promise.all([rawJobs(), rawApplications().catch(() => [])]);
  const job = jobs.find((j) => j.id === id);
  if (!job) throw { response: { status: 404, data: { detail: 'Job not found.' } } };
  return wrap(toEmpJob(job, apps));
};

export const updateJob = (_id: Id, _data: Record<string, unknown>): Res => unsupported('Editing a job');
export const deleteJob = (id: Id): Res => http.patch(`/employers/me/jobs/${id}/status`, { status: 'CLOSED' }); // jobs are closed, never hard-deleted
export const pauseJob = (id: Id): Res => http.patch(`/employers/me/jobs/${id}/status`, { status: 'PAUSED' });
export const activateJob = (id: Id): Res => http.post(`/employers/me/jobs/${id}/launch`); // also completes onboarding
export const closeJob = (id: Id): Res => http.patch(`/employers/me/jobs/${id}/status`, { status: 'CLOSED' });

/* ── Pipeline ───────────────────────────────────────────────── */
const STAGE_LABEL: Record<string, string> = {
  applied: 'Applied', in_review: 'In Review', shortlisted: 'Shortlisted', interview_scheduled: 'Interview Scheduled',
  interviewed: 'Interviewed', offer_received: 'Offer Received', accepted: 'Accepted', rejected: 'Rejected',
};

export const getPipeline = async (jobId?: Id): Res => {
  const apps = (await rawApplications()).filter((a) => !jobId || a.jobId === jobId).map(toPipelineApp);
  return wrap({
    total: apps.length,
    stages: Object.keys(STAGE_LABEL).map((status) => ({
      status, label: STAGE_LABEL[status], applications: apps.filter((a) => a.status === status),
    })),
  });
};

export const getApplication = async (id: Id): Res => {
  const app = (await rawApplications()).find((a) => a.id === id);
  if (!app) throw { response: { status: 404, data: { detail: 'Application not found.' } } };
  return wrap({ ...toPipelineApp(app), history: [], notes: [], offers: [] });
};

export const moveApplication = async (id: Id, status: string, _note?: string): Res => {
  const backendStatus = status.toUpperCase();
  const known = ['APPLIED', 'IN_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFER_RECEIVED', 'REJECTED', 'WITHDRAWN'];
  if (!known.includes(backendStatus)) return unsupported(`The "${status}" stage`);
  return http.patch(`/applications/${id}/status`, { status: backendStatus });
};

export const addNote = (_id: Id, _note: string, _rating?: number): Res => unsupported('Application notes');
export const shortlist = async (candidateId: Id, jobId: Id): Res => {
  const app = (await rawApplications()).find((a) => a.candidateId === candidateId && a.jobId === jobId);
  if (!app) return unsupported('Shortlisting a candidate who has not applied');
  return http.patch(`/applications/${app.id}/status`, { status: 'SHORTLISTED' });
};
export const inviteInterview = (_applicationId: Id, _message?: string): Res => unsupported('Interview invitations');
export const inviteCandidateToJob = (_candidateId: Id, _jobId: Id, _message?: string): Res => unsupported('Interview invitations');
export const sendOffer = (_data: Record<string, unknown>): Res => unsupported('Sending offers');

/* ── Talent ─────────────────────────────────────────────────── */
const toPoolCandidate = (a: any) => ({
  id: a.candidateId,
  name: a.candidate?.user?.fullName ?? 'Candidate',
  role: a.candidate?.primaryRole ?? null,
  headline: a.candidate?.primaryRole ?? null,
  experience: a.candidate?.experienceLevel ? String(a.candidate.experienceLevel).toLowerCase() : null,
  yearsExperience: null,
  location: null,
  availability: a.candidate?.availability ?? null,
  skills: a.candidate?.skillTags ?? [],
  aiScore: pct(a.aiMatchScore),
  rate: a.candidate?.minRate != null ? { min: a.candidate.minRate, preferred: a.candidate.preferredRate ?? null } : null,
  isSaved: false,
  matchScore: pct(a.aiMatchScore) ?? undefined,
});

/** The pool is the set of candidates who applied to this employer's active jobs (best match per candidate). */
const poolFromBackend = async (): Promise<any[]> => {
  const rows: any[] = (await http.get('/employers/me/candidates')).data;
  const best = new Map<string, any>();
  for (const r of rows) if (!best.has(r.candidateId)) best.set(r.candidateId, toPoolCandidate(r)); // rows arrive sorted by score
  return [...best.values()];
};

export const getCandidatePool = async (params?: Record<string, unknown>): Res => {
  const q = String(params?.q ?? params?.search ?? '').toLowerCase();
  const results = (await poolFromBackend()).filter(
    (c) => !q || [c.name, c.role, ...c.skills].filter(Boolean).some((t: string) => t.toLowerCase().includes(q))
  );
  return wrap({ results });
};

export const getCandidateProfile = async (id: Id): Res => {
  const c = (await poolFromBackend()).find((x) => x.id === id);
  if (!c) throw { response: { status: 404, data: { detail: 'Candidate not found.' } } };
  return wrap(c);
};

export const saveCandidate = (_id: Id): Res => unsupported('Saving candidates');
export const unsaveCandidate = (_id: Id): Res => unsupported('Saving candidates');

export const aiSearch = async (query: string): Res => {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const results = (await poolFromBackend())
    .map((c) => {
      const hay = [c.name, c.role, ...c.skills].filter(Boolean).map((t: string) => t.toLowerCase());
      const matchedSkills = c.skills.filter((s: string) => terms.some((t) => s.toLowerCase().includes(t)));
      const hits = terms.filter((t) => hay.some((h: string) => h.includes(t))).length;
      return { ...c, matchedSkills, matchScore: terms.length ? Math.round((hits / terms.length) * 100) : 0 };
    })
    .filter((c) => c.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
  return wrap({ query, terms, results });
};

/* ── Insights (computed from jobs, applications and payroll) ── */
export const getDashboard = async (): Res => {
  const [jobs, apps] = await Promise.all([rawJobs(), rawApplications()]);
  const count = (...s: string[]) => apps.filter((a) => s.includes(a.status)).length;
  const live = apps.filter((a) => !['REJECTED', 'WITHDRAWN'].includes(a.status));
  return wrap({
    openRoles: jobs.filter((j) => j.status === 'ACTIVE').length,
    activePipeline: live.length,
    offersExtended: count('OFFER_RECEIVED'),
    interviewsThisWeek: count('INTERVIEW_SCHEDULED'),
    totalApplicants: apps.length,
    recentActivity: [...apps]
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 5)
      .map((a) => ({ to_status: String(a.status).toLowerCase(), changed_at: a.updatedAt, title: a.job?.title ?? '', candidate: a.candidate?.user?.fullName ?? 'Candidate' })),
    topJobs: jobs.map((j) => toEmpJob(j, apps)).sort((a, b) => b.applicants - a.applicants).slice(0, 5)
      .map((j) => ({ id: j.id, title: j.title, status: j.status, applicants: j.applicants })),
  });
};

export const getAnalytics = async (): Res => {
  const apps = await rawApplications();
  const order = ['APPLIED', 'IN_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFER_RECEIVED'];
  const reached = (stage: string) => apps.filter((a) => order.indexOf(a.status) >= order.indexOf(stage)).length;
  const scored = apps.filter((a) => a.aiMatchScore != null);
  const weeks = new Map<string, number>();
  for (const a of apps) {
    const d = new Date(a.appliedAt);
    d.setDate(d.getDate() - d.getDay());
    const k = d.toISOString().slice(0, 10);
    weeks.set(k, (weeks.get(k) ?? 0) + 1);
  }
  return wrap({
    funnel: order.map((s) => ({ label: STAGE_LABEL[s.toLowerCase()], count: reached(s) })),
    sources: apps.length ? [{ source: 'platform', count: apps.length, percent: 100 }] : [],
    avgDaysToHire: null, avgDaysToShortlist: null,
    avgAiScore: scored.length ? Math.round(scored.reduce((s, a) => s + (pct(a.aiMatchScore) ?? 0), 0) / scored.length) : null,
    spendYtd: 0, jobViews: 0,
    hireRate: apps.length ? Math.round((apps.filter((a) => a.status === 'OFFER_RECEIVED').length / apps.length) * 100) : 0,
    weeklyApplicants: [...weeks.entries()].sort().map(([week, applicants]) => ({ week, applicants })),
  });
};

export const getPayroll = async (): Res => {
  const entries: any[] = (await http.get('/employers/me/payroll')).data;
  const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0);
  const paid = entries.filter((e) => e.status === 'PAID');
  return wrap({
    summary: {
      totalPayroll: sum(entries, (e) => e.gross),
      platformFees: sum(entries, (e) => e.gross - e.net),
      netDisbursed: sum(paid, (e) => e.net),
      pendingPayments: sum(entries.filter((e) => e.status === 'PENDING' || e.status === 'PROCESSING'), (e) => e.gross),
      activeContractors: new Set(entries.map((e) => e.candidateId)).size,
    },
    payments: entries.map((e) => ({
      id: e.id, invoice_number: e.invoiceNumber ?? '', period_start: e.periodStart ?? e.createdAt, period_end: e.periodEnd ?? e.createdAt,
      hours: e.hours, hourly_rate: e.rate, gross_amount: e.gross, fee_amount: e.gross - e.net, net_amount: e.net,
      status: String(e.status).toLowerCase(), paid_at: e.status === 'PAID' ? e.updatedAt : null, role: '',
      contractor: e.candidate?.user?.fullName ?? 'Contractor',
    })),
  });
};

// The backend stores interview results per candidate, not per employer.
export const getInterviewResults = async (): Res => wrap([]);
export const getInterviewDetail = (_id: Id): Res => unsupported('Interview results');

/* ── Team ───────────────────────────────────────────────────── */
export const getTeam = async (): Res => {
  const rows: any[] = (await http.get('/employers/me/team')).data;
  return wrap({
    members: rows.filter((m) => m.status !== 'invited').map((m, i) => ({ id: i + 1, name: m.email, email: m.email, role: m.role })),
    invitations: rows.filter((m) => m.status === 'invited').map((m) => ({ id: m.id, email: m.email, role: m.role, expires_at: '' })),
  });
};

export const inviteTeam = async (email: string, _role: string): Res => {
  const { data } = await http.post('/employers/me/team', { email });
  return wrap({ ...data, token: data.id });
};

export const removeTeam = (_id: Id | number): Res => unsupported('Removing team members');
