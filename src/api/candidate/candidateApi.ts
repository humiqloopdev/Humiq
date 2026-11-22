// src/api/candidate/candidateApi.ts
// Adapter between the candidate pages (snake_case view models) and the NestJS backend (Prisma shapes).
// Features the backend has no endpoint for (saved jobs, invitations, offers) are handled locally or return empty.
import http from '@/lib/http';

type Res = Promise<{ data: any }>;
const wrap = (data: unknown) => ({ data });
const unsupported = (what: string): never => {
  throw { response: { status: 501, data: { detail: `${what} is not available on this backend yet.` } } };
};

/* ── Mapping helpers ────────────────────────────────────────── */
const COMMITMENT_LABEL: Record<string, string> = {
  FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', FREELANCE: 'Freelance',
};
const COMMITMENT_ENUM: Record<string, string> = {
  'full-time': 'FULL_TIME', 'part-time': 'PART_TIME', contract: 'CONTRACT', freelance: 'FREELANCE',
  full_time: 'FULL_TIME', part_time: 'PART_TIME',
};
const EXPERIENCE_ENUM = ['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD'];
const toExperienceEnum = (v: unknown): string => {
  const up = String(v ?? '').toUpperCase();
  if (EXPERIENCE_ENUM.includes(up)) return up;
  const years = parseInt(String(v ?? ''), 10);
  if (Number.isNaN(years)) return 'MID';
  return years < 1 ? 'ENTRY' : years < 3 ? 'JUNIOR' : years < 6 ? 'MID' : years < 9 ? 'SENIOR' : 'LEAD';
};
const toCommitmentEnum = (v: unknown): string => COMMITMENT_ENUM[String(v ?? '').toLowerCase()] ?? 'FULL_TIME';

// Saved jobs live in this browser only (the backend has no saved-jobs endpoint).
const SAVED_KEY = 'talentai.savedJobs';
const readSaved = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]'); } catch { return []; }
};
const writeSaved = (ids: string[]) => {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(ids)); } catch { /* storage blocked */ }
};

/** Backend scores may be 0-1 fractions; the UI shows 0-100. */
const pct = (v: number | null | undefined): number | null => (v == null ? null : Math.round(v <= 1 ? v * 100 : v));

const toJob = (j: any, apps: Map<string, any>) => {
  const app = apps.get(j.id);
  return {
    id: j.id,
    title: j.title,
    company_name: j.employer?.companyName ?? '',
    description: j.description ?? null,
    commitment: COMMITMENT_LABEL[j.commitmentType] ?? null,
    rate_from: j.rateFrom ?? null,
    rate_to: j.rateTo ?? null,
    location: null,
    posted_at: j.createdAt,
    match_score: pct(app?.aiMatchScore) ?? 0,
    skills: j.requiredSkills ?? [],
    applicants: 0,
    is_saved: readSaved().includes(j.id),
    application_status: app ? String(app.status).toLowerCase() : null,
  };
};

const toApplication = (a: any) => ({
  id: a.id,
  status: String(a.status).toLowerCase(),
  match_score: pct(a.aiMatchScore),
  applied_at: a.appliedAt,
  status_changed_at: a.updatedAt,
  job_id: a.jobId,
  title: a.job?.title ?? '',
  company_name: a.job?.employer?.companyName ?? '',
});

const rawApplications = async (): Promise<any[]> => (await http.get('/candidates/me/applications')).data;

const INTERVIEW_STATUS: Record<string, string> = {
  SCHEDULED: 'scheduled', IN_PROGRESS: 'in_progress', COMPLETED: 'completed', CANCELLED: 'abandoned',
};
const toInterview = (i: any) => ({
  id: i.id,
  job_id: null,
  status: INTERVIEW_STATUS[i.status] ?? 'scheduled',
  overall_score: pct(i.aiScore),
  completed_at: i.status === 'COMPLETED' ? i.updatedAt : null,
  scheduled_at: i.scheduledAt ?? i.createdAt,
  title: i.type === 'AI_LIVE' ? 'AI Live Interview' : 'AI Practice Interview',
  company_name: null,
});

/** Backend stores questions as `{ questions: string[] }`; the room expects positioned objects. */
const toSession = (i: any, answers: Record<string, string> = {}) => {
  const raw: unknown = i.questions?.questions ?? i.questions ?? [];
  const list = Array.isArray(raw) ? raw : [];
  return {
    id: i.id,
    status: i.status === 'COMPLETED' ? 'completed' : i.status === 'CANCELLED' ? 'abandoned' : i.status === 'IN_PROGRESS' ? 'in_progress' : 'scheduled',
    questions: list.map((q: any, idx: number) => ({
      id: String(idx + 1),
      position: idx + 1,
      category: typeof q === 'object' && q?.category ? q.category : 'General',
      question_text: typeof q === 'string' ? q : q?.text ?? q?.question ?? '',
      transcript: answers[String(idx + 1)] ?? null,
    })),
  };
};

// The backend scores a whole interview in one call, so answers are collected here until the interview ends.
const answerBuffer = new Map<string, Record<string, string>>();

/* ── Profile ────────────────────────────────────────────────── */
export const getProfile = async (): Res => {
  const [{ data: user }, { data: p }] = await Promise.all([http.get('/users/me'), http.get('/candidates/me')]);
  const [firstName, ...rest] = String(user.fullName ?? '').split(' ');
  const hasPrefs = p.commitmentType || p.minRate != null || p.preferredRate != null;
  return wrap({
    firstName: firstName || null,
    lastName: rest.join(' ') || null,
    email: user.email,
    phone: user.phone ?? null,
    headline: p.primaryRole ?? null,
    primaryRole: p.primaryRole ?? null,
    experience: p.experienceLevel ? String(p.experienceLevel).toLowerCase() : null,
    location: null,
    timezone: p.timezone ?? null,
    availability: p.availability ?? null,
    bio: null,
    profileScore: profileScore(p, user),
    onboardingStep: p.onboardingStep,
    onboardingCompleted: p.onboardingCompleted,
    preferences: hasPrefs
      ? {
          commitment: COMMITMENT_LABEL[p.commitmentType] ?? null,
          minRate: p.minRate, preferredRate: p.preferredRate, timezone: p.timezone, availability: p.availability,
        }
      : null,
    skills: (p.skillTags ?? []).map((name: string) => ({ name, proficiency: 'intermediate' })),
    certifications: (p.certifications ?? []).map((name: string, i: number) => ({ id: String(i), name, issuer: null })),
    resume: p.resumeUrl
      ? { id: 'resume', file_name: String(p.resumeUrl).split(/[\\/]/).pop(), version: 1, parse_status: p.resumeParsedSkills ? 'parsed' : 'pending', uploaded_at: p.updatedAt }
      : null,
  });
};

function checklist(p: any, user: any) {
  return [
    { key: 'account', done: !!user?.fullName && !!user?.phone, label: 'Account details', sub: 'Name and phone number' },
    { key: 'resume', done: !!p.resumeUrl, label: 'Resume uploaded', sub: 'Upload a PDF or Word resume' },
    { key: 'skills', done: !!p.primaryRole && (p.skillTags?.length ?? 0) > 0, label: 'Skills & role', sub: 'Primary role and skill tags' },
    { key: 'preferences', done: !!p.commitmentType && p.minRate != null, label: 'Work preferences', sub: 'Commitment type, rate and timezone' },
  ];
}
const profileScore = (p: any, user: any) => {
  const items = checklist(p, user);
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
};

export const getProfileCompleteness = async (): Res => {
  const [{ data: user }, { data: p }] = await Promise.all([http.get('/users/me'), http.get('/candidates/me')]);
  return wrap({ score: profileScore(p, user), checklist: checklist(p, user) });
};

/** Onboarding page 1 (name/phone) is the only profile field set with a dedicated endpoint; step counters are server-managed. */
export const updateProfile = async (data: Record<string, unknown>): Res => {
  const d = data as Record<string, string | undefined>;
  if (d.firstName !== undefined || d.lastName !== undefined || d.phone !== undefined) {
    return wrap((await http.patch('/candidates/me/onboarding/step1', {
      firstName: d.firstName ?? '', lastName: d.lastName ?? '', ...(d.phone ? { phone: d.phone } : {}),
    })).data);
  }
  if (d.primaryRole !== undefined || d.experience !== undefined) {
    const { data: p } = await http.get('/candidates/me');
    return wrap((await http.patch('/candidates/me/onboarding/step3', {
      primaryRole: d.primaryRole ?? p.primaryRole ?? 'General',
      experienceLevel: toExperienceEnum(d.experience ?? p.experienceLevel),
      skillTags: p.skillTags ?? [],
      certifications: p.certifications ?? [],
    })).data);
  }
  // Pure step bookkeeping (onboardingStep / onboardingCompleted) is tracked by the server as steps are saved.
  return wrap({});
};

export const uploadResume = async (file: File): Res => {
  const f = new FormData();
  f.append('resume', file);
  return wrap((await http.post('/candidates/me/resume', f, { headers: { 'Content-Type': 'multipart/form-data' } })).data);
};

export const getResumeParseResult = async (): Res => {
  const { data: p } = await http.get('/candidates/me');
  if (!p.resumeUrl) throw { response: { status: 404, data: { detail: 'No resume uploaded.' } } };
  const parsed = p.resumeParsedSkills as { skills?: string[]; years?: number } | null;
  return wrap({
    file_name: String(p.resumeUrl).split(/[\\/]/).pop(),
    version: 1,
    parse_status: parsed ? 'parsed' : 'pending',
    parsed_data: parsed,
  });
};

export const updateSkills = async (skills: string[]): Res => {
  const { data: p } = await http.get('/candidates/me');
  return wrap((await http.patch('/candidates/me/onboarding/step3', {
    primaryRole: p.primaryRole ?? 'General',
    experienceLevel: p.experienceLevel ?? 'MID',
    skillTags: skills,
    certifications: p.certifications ?? [],
  })).data);
};

export const updatePreferences = async (prefs: Record<string, unknown>): Res =>
  wrap((await http.patch('/candidates/me/onboarding/step4', {
    commitmentType: toCommitmentEnum(prefs.commitment),
    minRate: Number(prefs.minRate ?? 0),
    preferredRate: Number(prefs.preferredRate ?? 0),
    timezone: String(prefs.timezone ?? 'UTC'),
    ...(prefs.availability ? { availability: String(prefs.availability) } : {}),
  })).data);

/* ── Jobs ───────────────────────────────────────────────────── */
export const searchJobs = async (params?: Record<string, unknown>): Res => {
  const [jobs, apps] = await Promise.all([
    http.get('/jobs', { params: { ...(params?.q ? { search: String(params.q) } : {}) } }),
    rawApplications().catch(() => []),
  ]);
  const byJob = new Map(apps.map((a) => [a.jobId, a]));
  const commitment = params?.commitment ? String(params.commitment).toLowerCase() : null;
  const results = (jobs.data as any[])
    .map((j) => toJob(j, byJob))
    .filter((j) => !commitment || j.commitment?.toLowerCase() === commitment);
  return wrap({ results });
};

export const getJobDetail = async (id: string | number): Res => {
  const [{ data: job }, apps] = await Promise.all([http.get(`/jobs/${id}`), rawApplications().catch(() => [])]);
  return wrap(toJob(job, new Map(apps.map((a) => [a.jobId, a]))));
};

export const applyToJob = (id: string | number): Res => http.post('/applications', { jobId: String(id) });

export const saveJob = async (id: string | number): Res => {
  writeSaved([...new Set([...readSaved(), String(id)])]);
  return wrap({});
};

export const unsaveJob = async (id: string | number): Res => {
  writeSaved(readSaved().filter((s) => s !== String(id)));
  return wrap({});
};

export const getSavedJobs = async (): Res => {
  const saved = new Set(readSaved());
  const { data } = await searchJobs();
  return wrap(data.results.filter((j: any) => saved.has(j.id)));
};

export const getRecommended = async (): Res => {
  const { data } = await searchJobs();
  return wrap([...data.results].sort((a: any, b: any) => b.match_score - a.match_score).slice(0, 10));
};

/* ── Applications ───────────────────────────────────────────── */
export const getApplications = async (): Res => wrap((await rawApplications()).map(toApplication));

export const getApplicationDetail = async (id: string | number): Res => {
  const app = (await rawApplications()).find((a) => a.id === String(id));
  if (!app) throw { response: { status: 404, data: { detail: 'Application not found.' } } };
  return wrap(toApplication(app));
};

export const withdrawApplication = (id: string | number): Res => http.patch(`/applications/${id}/withdraw`);

/* ── Interviews ─────────────────────────────────────────────── */
export const startInterview = async (jobId?: string | number): Res => {
  let applicationId: string | undefined;
  if (jobId) applicationId = (await rawApplications()).find((a) => a.jobId === String(jobId))?.id;
  const { data } = await http.post('/candidates/me/interviews/start', { type: 'AI_PRACTICE', ...(applicationId ? { applicationId } : {}) });
  answerBuffer.set(data.id, {});
  return wrap(toSession(data));
};

export const getInterviewSession = async (id: string | number): Res => {
  const { data } = await http.get(`/interviews/${id}`);
  return wrap(toSession(data, answerBuffer.get(String(id))));
};

export const submitAnswer = async (sid: string | number, qid: string | number, text: string): Res => {
  const buf = answerBuffer.get(String(sid)) ?? {};
  buf[String(qid)] = text;
  answerBuffer.set(String(sid), buf);
  return wrap({});
};

export const endInterview = async (id: string | number): Res => {
  const sid = String(id);
  const { data: session } = await http.get(`/interviews/${sid}`);
  const questions = toSession(session).questions;
  const answers = answerBuffer.get(sid) ?? {};
  const transcript = questions
    .map((q) => `Q${q.position}: ${q.question_text}\nA: ${answers[q.id] ?? '(no answer)'}`)
    .join('\n\n');
  const { data } = await http.patch(`/interviews/${sid}/submit`, { transcript });
  answerBuffer.delete(sid);
  return wrap({
    id: data.id, status: 'completed', answered: Object.keys(answers).length, total: questions.length,
    scoringStatus: data.aiScore != null ? 'scored' : 'pending',
  });
};

export const getInterviewResults = async (id: string | number): Res => {
  const { data } = await http.get(`/interviews/${id}`);
  return wrap({
    overallScore: pct(data.aiScore),
    scores: data.aiScore != null ? [{ category: 'Overall', score: pct(data.aiScore) }] : [],
  });
};

export const getInterviewHistory = async (): Res =>
  wrap(((await http.get('/interviews')).data as any[]).map(toInterview));

/* ── Dashboard & payments ───────────────────────────────────── */
export const getDashboard = async (): Res => {
  const [apps, interviews, prof] = await Promise.all([rawApplications(), http.get('/interviews'), getProfile()]);
  const scored = (interviews.data as any[]).filter((i) => i.aiScore != null);
  const live = apps.filter((a) => !['REJECTED', 'WITHDRAWN'].includes(a.status));
  return wrap({
    profileScore: prof.data.profileScore,
    activeApplications: live.length,
    offers: apps.filter((a) => a.status === 'OFFER_RECEIVED').length,
    interviewsScheduled: (interviews.data as any[]).filter((i) => i.status === 'SCHEDULED').length,
    interviewsPending: (interviews.data as any[]).filter((i) => i.status === 'IN_PROGRESS').length,
    avgAiScore: scored.length ? Math.round(scored.reduce((s, i) => s + (pct(i.aiScore) ?? 0), 0) / scored.length) : null,
    savedJobs: readSaved().length,
  });
};

export const getPayments = async (): Res => {
  const [{ data: entries }, { data: methods }] = await Promise.all([
    http.get('/candidates/me/payroll'), http.get('/candidates/me/payment-methods'),
  ]);
  const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0);
  return wrap({
    summary: {
      totalEarned: sum(entries.filter((e: any) => e.status === 'PAID'), (e) => e.net),
      pendingPayout: sum(entries.filter((e: any) => e.status !== 'PAID' && e.status !== 'FAILED'), (e) => e.net),
      grossBilled: sum(entries, (e) => e.gross),
    },
    payoutMethods: methods.map((m: any) => ({
      id: m.id, method_type: 'bank', label: m.bankName, account_last4: m.accountLast4, is_default: m.isDefault,
    })),
    payments: entries.map((e: any) => ({
      id: e.id, invoice_number: e.invoiceNumber ?? '', period_start: e.periodStart ?? e.createdAt, period_end: e.periodEnd ?? e.createdAt,
      hours: e.hours, gross_amount: e.gross, fee_amount: e.gross - e.net, net_amount: e.net,
      status: String(e.status).toLowerCase(), paid_at: e.status === 'PAID' ? e.updatedAt : null, employer: '',
    })),
  });
};

/* ── Employer invitations & offers (no backend support yet) ─── */
export const getInvitations = async (): Res => wrap([]);
export const respondInvitation = async (_id: string, _accept: boolean): Res => unsupported('Interview invitations');
export const getOffers = async (): Res => wrap([]);
export const respondOffer = async (_id: string, _accept: boolean): Res => unsupported('Job offers');
