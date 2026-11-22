// src/api/aiInterviews/useOpenInterviews.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Api from './openInterviewsApi';

export * from './openInterviewsApi';

/** The listing refreshes on its own (every 30s and whenever the tab regains focus), so newly published interviews show up without a reload. */
export const useOpenInterviews = (all = false) =>
  useQuery({ queryKey: ['open-interviews', { all }], queryFn: () => Api.listOpenInterviews(all), refetchInterval: 30_000, refetchOnWindowFocus: true });

export const useOpenInterview = (id?: string) =>
  useQuery({ queryKey: ['open-interview', id], queryFn: () => Api.getOpenInterview(id!), enabled: !!id, refetchOnWindowFocus: true, retry: false });

export const useAttendOpenInterview = () => useMutation({ mutationFn: ({ id, email }: { id: string; email: string }) => Api.attendOpenInterview(id, email) });
