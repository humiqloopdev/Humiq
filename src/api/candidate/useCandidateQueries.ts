// src/api/candidate/useCandidateQueries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as CandidateAPI from './candidateApi';

export const candidateKeys = {
  all: ['candidate'] as const,
  profile: ['candidate', 'profile'] as const,
  jobs: (params?: Record<string, unknown>) => ['candidate', 'jobs', params] as const,
  savedJobs: ['candidate', 'saved-jobs'] as const,
  recommended: ['candidate', 'recommended'] as const,
  applications: ['candidate', 'applications'] as const,
  dashboard: ['candidate', 'dashboard'] as const,
  interviews: ['candidate', 'interviews'] as const,
  interviewResults: (id: string) => ['candidate', 'interview-results', id] as const,
};

/* ── Backend response shapes (snake_case, as sent by the API) ── */
export interface ApiJob {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
  commitment: string | null;
  rate_from: number | null;
  rate_to: number | null;
  location: string | null;
  posted_at: string;
  match_score: number;
  skills: string[];
  applicants: number;
  is_saved: boolean;
  application_status: string | null;
}

export interface ApiApplication {
  id: string;
  status: string;
  match_score: number | null;
  applied_at: string;
  status_changed_at: string;
  job_id: string;
  title: string;
  company_name: string;
}

export interface ApiDashboard {
  profileScore: number;
  activeApplications: number;
  offers: number;
  interviewsScheduled: number;
  interviewsPending: number;
  avgAiScore: number | null;
  savedJobs: number;
}

export interface ApiInterview {
  id: string;
  job_id: string | null;
  status: string;
  overall_score: number | null;
  completed_at: string | null;
  scheduled_at: string | null;
  title: string | null;
  company_name: string | null;
}

export interface ApiInterviewResults {
  overallScore: number | null;
  scores: { category: string; score: number }[];
}

/* ── Queries ─────────────────────────────────────────────── */
export function useCandidateProfile() {
  return useQuery({
    queryKey: candidateKeys.profile,
    queryFn: async () => (await CandidateAPI.getProfile()).data,
  });
}

export function useJobSearch(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: candidateKeys.jobs(params),
    queryFn: async () => (await CandidateAPI.searchJobs(params)).data as { results: ApiJob[] },
  });
}

export function useCandidateDashboard() {
  return useQuery({
    queryKey: candidateKeys.dashboard,
    queryFn: async () => (await CandidateAPI.getDashboard()).data as ApiDashboard,
  });
}

export function useSavedJobs() {
  return useQuery({
    queryKey: candidateKeys.savedJobs,
    queryFn: async () => (await CandidateAPI.getSavedJobs()).data as ApiJob[],
  });
}

export function useRecommendedJobs() {
  return useQuery({
    queryKey: candidateKeys.recommended,
    queryFn: async () => (await CandidateAPI.getRecommended()).data as ApiJob[],
  });
}

export function useApplications() {
  return useQuery({
    queryKey: candidateKeys.applications,
    queryFn: async () => (await CandidateAPI.getApplications()).data as ApiApplication[],
  });
}

export function useInterviewHistory() {
  return useQuery({
    queryKey: candidateKeys.interviews,
    queryFn: async () => (await CandidateAPI.getInterviewHistory()).data as ApiInterview[],
  });
}

export function useInterviewResults(id?: string) {
  return useQuery({
    queryKey: candidateKeys.interviewResults(id ?? ''),
    queryFn: async () => (await CandidateAPI.getInterviewResults(id!)).data as ApiInterviewResults,
    enabled: !!id,
  });
}

/* ── Mutations (any change refreshes every candidate query) ── */
function useCandidateMutation<TArg>(fn: (arg: TArg) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: candidateKeys.all }),
  });
}

export const useApplyToJob = () => useCandidateMutation((id: string) => CandidateAPI.applyToJob(id));
export const useSaveJob = () => useCandidateMutation((id: string) => CandidateAPI.saveJob(id));
export const useUnsaveJob = () => useCandidateMutation((id: string) => CandidateAPI.unsaveJob(id));
export const useWithdrawApplication = () => useCandidateMutation((id: string) => CandidateAPI.withdrawApplication(id));
export const useUploadResume = () => useCandidateMutation((file: File) => CandidateAPI.uploadResume(file));

export { apiErrorMessage } from '@/lib/utils';

/* ── Profile, resume, payments ───────────────────────────── */
export interface ApiProfile {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  headline: string | null;
  primaryRole: string | null;
  experience: string | null;
  location: string | null;
  timezone: string | null;
  availability: string | null;
  bio: string | null;
  profileScore: number;
  preferences: { commitment: string | null; minRate: number | null; preferredRate: number | null; timezone: string | null; availability: string | null } | null;
  skills: { name: string; proficiency: string }[];
  certifications: { id: string; name: string; issuer: string | null }[];
  resume: { id: string; file_name: string; version: number; parse_status: string; uploaded_at: string } | null;
}

export interface ApiCompleteness {
  score: number;
  checklist: { key: string; done: boolean; label: string; sub: string }[];
}

export interface ApiParsedResume {
  file_name: string;
  version: number;
  parse_status: 'pending' | 'parsed' | 'failed';
  parsed_data: { skills?: string[]; years?: number } | null;
}

export interface ApiPayments {
  summary: { totalEarned: number; pendingPayout: number; grossBilled: number };
  payoutMethods: { id: string; method_type: string; label: string; account_last4: string | null; is_default: boolean }[];
  payments: {
    id: string; invoice_number: string; period_start: string; period_end: string; hours: number;
    gross_amount: number; fee_amount: number; net_amount: number; status: string; paid_at: string | null; employer: string;
  }[];
}

export const completenessKey = ['candidate', 'completeness'] as const;

export function useProfile() {
  return useQuery({ queryKey: candidateKeys.profile, queryFn: async () => (await CandidateAPI.getProfile()).data as ApiProfile });
}

export function useProfileCompleteness() {
  return useQuery({
    queryKey: completenessKey,
    queryFn: async () => (await CandidateAPI.getProfileCompleteness()).data as ApiCompleteness,
  });
}

export function useParsedResume(enabled = true) {
  return useQuery({
    queryKey: ['candidate', 'resume-parsed'],
    queryFn: async () => (await CandidateAPI.getResumeParseResult()).data as ApiParsedResume,
    enabled,
    retry: false,
  });
}

export function usePayments() {
  return useQuery({ queryKey: ['candidate', 'payments'], queryFn: async () => (await CandidateAPI.getPayments()).data as ApiPayments });
}

export const useUpdateProfile = () => useCandidateMutation((data: Record<string, unknown>) => CandidateAPI.updateProfile(data));
export const useUpdateSkills = () => useCandidateMutation((skills: string[]) => CandidateAPI.updateSkills(skills));
export const useUpdatePreferences = () => useCandidateMutation((prefs: Record<string, unknown>) => CandidateAPI.updatePreferences(prefs));

/* ── Interview room ──────────────────────────────────────── */
export interface ApiInterviewSession {
  id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'abandoned';
  questions: { id: string; position: number; category: string; question_text: string; transcript: string | null }[];
}

export interface ApiInterviewEnd {
  id: string;
  status: 'completed' | 'abandoned';
  answered: number;
  total: number;
  scoringStatus: string;
}

export function useInterviewSession(id: string) {
  return useQuery({
    queryKey: ['candidate', 'interview-session', id],
    queryFn: async () => (await CandidateAPI.getInterviewSession(id)).data as ApiInterviewSession,
  });
}

/** Starts (or resumes) an interview; resolves to the session. */
export function useStartInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId?: string) => (await CandidateAPI.startInterview(jobId)).data as ApiInterviewSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: candidateKeys.all }),
  });
}

export function useSubmitAnswer(sessionId: string) {
  return useMutation({
    mutationFn: ({ questionId, text }: { questionId: string; text: string }) =>
      CandidateAPI.submitAnswer(sessionId, questionId, text),
  });
}

export function useEndInterview(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await CandidateAPI.endInterview(sessionId)).data as ApiInterviewEnd,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: candidateKeys.all }),
  });
}

/* ── Employer invitations & offers ───────────────────────── */
export interface ApiInvitation {
  id: string; status: string; message: string | null; scheduled_at: string | null; expires_at: string; title: string; company_name: string;
}
export interface ApiOffer {
  id: string; status: string; hourly_rate: number; commitment: string | null; start_date: string; expires_at: string;
  message: string | null; title: string; company_name: string;
}

export function useInvitations() {
  return useQuery({ queryKey: ['candidate', 'invitations'], queryFn: async () => (await CandidateAPI.getInvitations()).data as ApiInvitation[] });
}
export function useOffers() {
  return useQuery({ queryKey: ['candidate', 'offers'], queryFn: async () => (await CandidateAPI.getOffers()).data as ApiOffer[] });
}
export const useRespondInvitation = () =>
  useCandidateMutation(({ id, accept }: { id: string; accept: boolean }) => CandidateAPI.respondInvitation(id, accept));
export const useRespondOffer = () =>
  useCandidateMutation(({ id, accept }: { id: string; accept: boolean }) => CandidateAPI.respondOffer(id, accept));
