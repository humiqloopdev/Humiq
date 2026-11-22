// src/api/aiInterviews/useAiInterviews.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Api from './aiInterviewsApi';

export * from './aiInterviewsApi';
export { apiErrorMessage } from '@/lib/utils';

const key = (...parts: unknown[]) => ['ai', ...parts];

export const useAiDashboard = () => useQuery({ queryKey: key('dashboard'), queryFn: Api.getDashboard });
export const useAiTemplates = () => useQuery({ queryKey: key('templates'), queryFn: Api.getTemplates, staleTime: Infinity });
export const useAiInterviews = () => useQuery({ queryKey: key('interviews'), queryFn: Api.listInterviews });
export const useAiInterview = (id?: string) => useQuery({ queryKey: key('interview', id), queryFn: () => Api.getInterview(id!), enabled: !!id });
export const useAiCandidates = (interviewId?: string) =>
  useQuery({ queryKey: key('candidates', interviewId ?? 'all'), queryFn: () => (interviewId ? Api.listCandidates(interviewId) : Api.listAllCandidates()) });
export const useAiSessions = (params?: { interviewId?: string; status?: string }) =>
  useQuery({ queryKey: key('sessions', params), queryFn: () => Api.listSessions(params) });
export const useAiSession = (id?: string) => useQuery({ queryKey: key('session', id), queryFn: () => Api.getSession(id!), enabled: !!id });

/** Any change refreshes every AI-interviews query (dashboard counts depend on all of them). */
function useAiMutation<TArg, TRes = unknown>(fn: (arg: TArg) => Promise<TRes>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai'] }) });
}

export const useCreateInterview = () => useAiMutation(Api.createInterview);
export const useCreateFromTemplate = () => useAiMutation(Api.createFromTemplate);
export const useUpdateInterview = () => useAiMutation(({ id, body }: { id: string; body: Parameters<typeof Api.updateInterview>[1] }) => Api.updateInterview(id, body));
export const useDeleteInterviews = () => useAiMutation(Api.deleteInterviews);
export const useDuplicateInterview = () => useAiMutation(Api.duplicateInterview);
export const usePublishInterview = () => useAiMutation(Api.publishInterview);
export const useUnpublishInterview = () => useAiMutation(Api.unpublishInterview);
export const useAddQuestion = () => useAiMutation(({ interviewId, body }: { interviewId: string; body: Parameters<typeof Api.addQuestion>[1] }) => Api.addQuestion(interviewId, body));
export const useUpdateQuestion = () => useAiMutation(({ id, body }: { id: string; body: Parameters<typeof Api.updateQuestion>[1] }) => Api.updateQuestion(id, body));
export const useDeleteQuestion = () => useAiMutation(Api.deleteQuestion);
export const useReorderQuestions = () => useAiMutation(({ interviewId, ids }: { interviewId: string; ids: string[] }) => Api.reorderQuestions(interviewId, ids));
export const useAddCandidate = () => useAiMutation(({ interviewId, body }: { interviewId: string; body: Parameters<typeof Api.addCandidate>[1] }) => Api.addCandidate(interviewId, body));
export const useInviteByEmail = () => useAiMutation(({ interviewId, body }: { interviewId: string; body: Parameters<typeof Api.inviteByEmail>[1] }) => Api.inviteByEmail(interviewId, body));
export const useAddCandidates = () => useAiMutation(({ interviewId, rows }: { interviewId: string; rows: Parameters<typeof Api.addCandidates>[1] }) => Api.addCandidates(interviewId, rows));
export const useDeleteCandidates = () => useAiMutation(Api.deleteCandidates);
export const useDeleteSessions = () => useAiMutation(Api.deleteSessions);
export const useSummarizeSession = () => useAiMutation(Api.summarizeSession);
