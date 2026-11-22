// src/api/admin/useAdminQueries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as AdminAPI from './adminApi';

/* ── Response shapes ─────────────────────────────────────────── */
export interface AdminOverview {
  candidates: number; newCandidates7d: number; employers: number; newEmployers30d: number;
  interviews30d: number; interviewsChangePct: number | null; gmv30d: number; gmvChangePct: number | null;
  activeJobs: number; applications: number; openFlags: number; openDisputes: number; pendingDeletions: number; pendingKyc: number;
}
export interface AdminUser {
  id: number; name: string; username: string | null; email: string; role: 'candidate' | 'employer' | 'admin';
  status: 'active' | 'suspended' | 'deleted'; created_at: string; last_login_at: string | null; ai_score: number | null; company: string | null;
}
export interface AdminEmployer {
  id: string; name: string; industry: string | null; headquarters: string | null; plan: 'starter' | 'pro' | 'enterprise';
  kyc_status: 'pending' | 'verified' | 'rejected'; created_at: string; active_roles: number; members: number;
}
export interface AdminJob {
  id: string; title: string; company_name: string; status: string; moderation_status: 'approved' | 'flagged' | 'removed';
  moderation_note: string | null; posted_at: string; applicants: number;
}
export interface AdminJobs { stats: { activeListings: number; totalApplications: number; filled30d: number }; jobs: AdminJob[] }
export interface AdminFlag {
  id: string; reason: string; severity: string; details: string | null; status: string; created_at: string; candidate: string; job_title: string | null;
}
export interface AdminFinance {
  summary: { gmv30d: number; pendingPayouts: number; feesCollected: number; openDisputes: number };
  transactions: { id: string; invoice_number: string; period_end: string; gross_amount: number; fee_amount: number; net_amount: number; status: string; employer: string; candidate: string; disputed: boolean }[];
}
export interface AdminDispute {
  id: string; reason: string; invoice_number: string; gross_amount: number; net_amount: number; employer: string; candidate: string; created_at: string;
}
export interface AdminCompliance {
  summary: { pendingDeletions: number; overdueDeletions: number; auditEvents: number };
  policies: { policy: string; status: string }[];
}
export interface AdminDeletion { id: string; requested_at: string; due_at: string; name: string; email: string; role: string; overdue: boolean }
export interface AdminAuditEvent { id: string; action: string; entity_type: string; created_at: string; actor: string | null; company: string | null }
export interface AdminPlan { code: string; name: string; priceMonthly: number | null; maxRoles: number | null; features: string[]; isActive: boolean }
export interface PlatformSettings {
  platformName: string; currency: string; commissionPercent: number; trialDays: number; maintenanceMode: boolean; emailNotifications: boolean; adminTwoFactor: boolean;
}
export interface InterviewConfig {
  questionsPerRole: number; maxDurationMinutes: number; maxAnswerMinutes: number; aiToolDetection: boolean;
  recordingRetentionDays: number; retakePolicy: 'unlimited' | 'one_attempt' | 'technical_failures_only'; practiceMode: boolean;
}
export interface ScoringModel {
  weights: { technical_depth: number; communication: number; system_design: number; problem_solving: number };
  tiers: { tier: string; min: number; label: string; visibility: string }[];
}
export interface LlmSettings {
  model: string; fallbackModel: string; temperature: number; maxTokens: number; contextWindow: number; monthlyTokenBudget: number; systemPrompt: string;
}
export interface TokenUsage {
  usedThisMonth: number; calls: number; budget: number; percentUsed: number; apiKeyConfigured: boolean;
  byPurpose: { purpose: string; tokens: number; calls: number }[]; byDay: { day: string; tokens: number }[];
}

/* ── Queries ─────────────────────────────────────────────────── */
const k = (...parts: unknown[]) => ['admin', ...parts];
const q = <T,>(key: unknown[], fn: () => Promise<{ data: unknown }>) =>
  useQuery({ queryKey: key, queryFn: async () => (await fn()).data as T });

export const useOverview = () => q<AdminOverview>(k('overview'), AdminAPI.getOverview);
export const useAdminUsers = (params: Record<string, unknown>) =>
  q<{ total: number; results: AdminUser[] }>(k('users', params), () => AdminAPI.getUsers(params));
export const useAdminEmployers = (params?: Record<string, unknown>) => q<AdminEmployer[]>(k('employers', params), () => AdminAPI.getEmployers(params));
export const useAdminJobs = (params?: Record<string, unknown>) => q<AdminJobs>(k('jobs', params), () => AdminAPI.getJobListings(params));
export const useFlags = (status = 'open') => q<AdminFlag[]>(k('flags', status), () => AdminAPI.getFlagged(status));
export const useFinance = () => q<AdminFinance>(k('finance'), () => AdminAPI.getTransactions());
export const useDisputes = () => q<AdminDispute[]>(k('disputes'), () => AdminAPI.getDisputes());
export const useCompliance = () => q<AdminCompliance>(k('compliance'), AdminAPI.getCompliance);
export const useDeletions = () => q<AdminDeletion[]>(k('deletions'), () => AdminAPI.getDeletions());
export const useAuditTrail = () => q<AdminAuditEvent[]>(k('audit'), () => AdminAPI.getAuditTrail({ pageSize: 15 }));
export const usePlans = () => q<AdminPlan[]>(k('plans'), AdminAPI.getPlans);
export const usePlatformSettings = () => q<PlatformSettings>(k('settings'), AdminAPI.getSettings);
export const useInterviewConfig = () => q<InterviewConfig>(k('interview-config'), AdminAPI.getInterviewConfig);
export const useScoringModel = () => q<ScoringModel>(k('scoring'), AdminAPI.getScoringModel);
export const useLlmSettings = () => q<LlmSettings>(k('llm'), AdminAPI.getLlmSettings);
export const useTokenUsage = () => q<TokenUsage>(k('token-usage'), AdminAPI.getTokenUsage);

/* ── Mutations (any change refreshes every admin query) ──────── */
function useAdminMutation<TArg, TRes = unknown>(fn: (arg: TArg) => Promise<{ data: TRes }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arg: TArg) => (await fn(arg)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export const useSetUserStatus = () => useAdminMutation(({ id, status }: { id: number; status: 'active' | 'suspended' }) => AdminAPI.setUserStatus(id, status));
export const useSetKyc = () => useAdminMutation(({ id, status, notes }: { id: string; status: string; notes?: string }) => AdminAPI.updateKyc(id, status, notes));
export const useSetEmployerPlan = () => useAdminMutation(({ id, plan }: { id: string; plan: string }) => AdminAPI.updateEmployerPlan(id, plan));
export const useModerateJob = () => useAdminMutation(({ id, action, note }: { id: string; action: string; note?: string }) => AdminAPI.moderateJob(id, action, note));
export const useResolveFlag = () => useAdminMutation(({ id, resolution, note }: { id: string; resolution: 'resolved' | 'dismissed'; note?: string }) => AdminAPI.resolveFlag(id, resolution, note));
export const useRunPayroll = () =>
  useAdminMutation<void, { payments: number; totalNet: number }>(() => AdminAPI.processPayroll());
export const useResolveDispute = () => useAdminMutation(({ id, resolution, note }: { id: string; resolution: 'refunded' | 'rejected'; note?: string }) => AdminAPI.resolveDispute(id, resolution, note));
export const useProcessDeletion = () => useAdminMutation((id: string) => AdminAPI.processDeletion(id));
export const useSavePlatform = () => useAdminMutation((s: Record<string, unknown>) => AdminAPI.updateSettings(s));
export const useSaveInterviewConfig = () => useAdminMutation((s: Record<string, unknown>) => AdminAPI.updateInterviewConfig(s));
export const useSaveScoring = () => useAdminMutation((s: Record<string, unknown>) => AdminAPI.updateScoringModel(s));
export const useSaveLlm = () => useAdminMutation((s: Record<string, unknown>) => AdminAPI.updateLlmSettings(s));
export const useSavePlan = () => useAdminMutation(({ code, data }: { code: string; data: Record<string, unknown> }) => AdminAPI.updatePlan(code, data));
