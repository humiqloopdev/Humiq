// src/api/employer/useEmployerQueries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as EmployerAPI from './employerApi';

/* ── Response shapes (as sent by the backend) ───────────────── */
export interface ApiCompany {
  id: string | null;
  companyName?: string;
  website?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  size?: string | null;
  description?: string | null;
  plan?: 'starter' | 'pro' | 'enterprise';
  trialEndsAt?: string | null;
  billingEmail?: string | null;
  role: 'owner' | 'admin' | 'recruiter' | 'viewer' | null;
}

export interface EmpJob {
  id: string;
  title: string;
  role_type: string | null;
  commitment: string | null;
  rate_from: number | null;
  rate_to: number | null;
  experience_level: string | null;
  description: string | null;
  location: string | null;
  status: 'draft' | 'active' | 'paused' | 'closed';
  posted_at: string;
  skills: string[];
  applicants: number;
  shortlisted: number;
  views: number;
}

export interface PipelineApp {
  id: string;
  status: string;
  stage: string;
  matchScore: number | null;
  source: string;
  appliedAt: string;
  statusChangedAt: string;
  job: { id: string; title: string };
  candidate: { id: string; name: string; role: string | null; experience: string | null; location: string | null; aiScore: number | null };
}

export interface Pipeline {
  total: number;
  stages: { status: string; label: string; applications: PipelineApp[] }[];
}

export interface AppDetail extends PipelineApp {
  history: { from_status: string | null; to_status: string; note: string | null; changed_at: string }[];
  notes: { id: string; note: string; rating: number | null; created_at: string; author: string | null }[];
  offers: { id: string; hourly_rate: number; start_date: string; status: string }[];
}

export interface PoolCandidate {
  id: string;
  name: string;
  role: string | null;
  headline: string | null;
  experience: string | null;
  yearsExperience: number | null;
  location: string | null;
  availability: string | null;
  skills: string[];
  aiScore: number | null;
  rate: { min: number; preferred: number | null } | null;
  isSaved: boolean;
  matchScore?: number;
  matchedSkills?: string[];
}

export interface EmpDashboard {
  openRoles: number;
  activePipeline: number;
  offersExtended: number;
  interviewsThisWeek: number;
  totalApplicants: number;
  recentActivity: { to_status: string; changed_at: string; title: string; candidate: string }[];
  topJobs: { id: string; title: string; status: string; applicants: number }[];
}

export interface EmpAnalytics {
  funnel: { label: string; count: number }[];
  sources: { source: string; count: number; percent: number }[];
  avgDaysToHire: number | null;
  avgDaysToShortlist: number | null;
  avgAiScore: number | null;
  spendYtd: number;
  jobViews: number;
  hireRate: number;
  weeklyApplicants: { week: string; applicants: number }[];
}

export interface EmpPayroll {
  summary: { totalPayroll: number; platformFees: number; netDisbursed: number; pendingPayments: number; activeContractors: number };
  payments: {
    id: string; invoice_number: string; period_start: string; period_end: string; hours: number; hourly_rate: number;
    gross_amount: number; fee_amount: number; net_amount: number; status: string; paid_at: string | null; role: string; contractor: string;
  }[];
}

export interface EmpInterview {
  id: string;
  status: string;
  overall_score: number | null;
  scoring_status: string;
  completed_at: string | null;
  scheduled_at: string | null;
  job_title: string;
  candidate: string;
}

export interface EmpInterviewDetail {
  overallScore: number | null;
  scoringStatus: string;
  scores: { category: string; score: number }[];
  answers: { position: number; category: string; question_text: string; transcript: string | null }[];
}

export interface EmpTeam {
  members: { id: number; name: string; email: string; role: string }[];
  invitations: { id: string; email: string; role: string; expires_at: string }[];
}

/* ── Queries ─────────────────────────────────────────────────── */
export const employerKeys = { all: ['employer'] as const };
const key = (...parts: unknown[]) => ['employer', ...parts];

export const useCompany = () =>
  useQuery({ queryKey: key('profile'), queryFn: async () => (await EmployerAPI.getProfile()).data as ApiCompany });

export const useEmployerJobs = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: key('jobs', params), queryFn: async () => (await EmployerAPI.getJobs(params)).data as EmpJob[] });

export const usePipeline = (jobId?: string) =>
  useQuery({ queryKey: key('pipeline', jobId), queryFn: async () => (await EmployerAPI.getPipeline(jobId)).data as Pipeline });

export const useApplicationDetail = (id?: string) =>
  useQuery({ queryKey: key('application', id), queryFn: async () => (await EmployerAPI.getApplication(id!)).data as AppDetail, enabled: !!id });

export const useCandidatePool = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: key('candidates', params),
    queryFn: async () => (await EmployerAPI.getCandidatePool(params)).data as { results: PoolCandidate[] },
  });

export const useEmployerDashboard = () =>
  useQuery({ queryKey: key('dashboard'), queryFn: async () => (await EmployerAPI.getDashboard()).data as EmpDashboard });

export const useEmployerAnalytics = () =>
  useQuery({ queryKey: key('analytics'), queryFn: async () => (await EmployerAPI.getAnalytics()).data as EmpAnalytics });

export const useEmployerPayroll = () =>
  useQuery({ queryKey: key('payroll'), queryFn: async () => (await EmployerAPI.getPayroll()).data as EmpPayroll });

export const useInterviewResults = () =>
  useQuery({ queryKey: key('interviews'), queryFn: async () => (await EmployerAPI.getInterviewResults()).data as EmpInterview[] });

export const useInterviewDetail = (id?: string) =>
  useQuery({ queryKey: key('interview', id), queryFn: async () => (await EmployerAPI.getInterviewDetail(id!)).data as EmpInterviewDetail, enabled: !!id });

export const useTeam = () =>
  useQuery({ queryKey: key('team'), queryFn: async () => (await EmployerAPI.getTeam()).data as EmpTeam });

/* ── Mutations (any change refreshes every employer query) ──── */
function useEmployerMutation<TArg, TRes = unknown>(fn: (arg: TArg) => Promise<{ data: TRes }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arg: TArg) => (await fn(arg)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employerKeys.all }),
  });
}

export const useSaveCompany = () => useEmployerMutation((data: Record<string, unknown>) => EmployerAPI.updateProfile(data));
export const useJobAction = () =>
  useEmployerMutation(({ id, action }: { id: string; action: 'activate' | 'pause' | 'close' | 'delete' }) =>
    action === 'delete' ? EmployerAPI.deleteJob(id)
      : action === 'activate' ? EmployerAPI.activateJob(id)
        : action === 'pause' ? EmployerAPI.pauseJob(id) : EmployerAPI.closeJob(id));
export const useMoveApplication = () =>
  useEmployerMutation(({ id, status, note }: { id: string; status: string; note?: string }) => EmployerAPI.moveApplication(id, status, note));
export const useAddNote = () =>
  useEmployerMutation(({ id, note, rating }: { id: string; note: string; rating?: number }) => EmployerAPI.addNote(id, note, rating));
export const useInviteInterview = () =>
  useEmployerMutation(({ applicationId, message }: { applicationId: string; message?: string }) => EmployerAPI.inviteInterview(applicationId, message));
export const useSendOffer = () =>
  useEmployerMutation((data: { application_id?: string; candidate_id?: string; job_id?: string; rate: number; start_date: string; message?: string }) =>
    EmployerAPI.sendOffer(data));
export const useShortlistCandidate = () =>
  useEmployerMutation(({ candidateId, jobId }: { candidateId: string; jobId: string }) => EmployerAPI.shortlist(candidateId, jobId));
export const useToggleSaveCandidate = () =>
  useEmployerMutation(({ id, saved }: { id: string; saved: boolean }) => (saved ? EmployerAPI.unsaveCandidate(id) : EmployerAPI.saveCandidate(id)));
export const useInviteTeam = () =>
  useEmployerMutation(({ email, role }: { email: string; role: string }) => EmployerAPI.inviteTeam(email, role) as Promise<{ data: { token: string } }>);
export const useRemoveTeamEntry = () => useEmployerMutation((id: string | number) => EmployerAPI.removeTeam(id));

/** AI/keyword search is a query the user triggers, so it is a mutation. */
export const useAiSearch = () =>
  useMutation({
    mutationFn: async (query: string) =>
      (await EmployerAPI.aiSearch(query)).data as { query: string; terms: string[]; results: PoolCandidate[] },
  });
