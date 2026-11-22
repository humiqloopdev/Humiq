// src/api/aiInterviews/openInterviewsApi.ts
// Candidate-side listing of published AI interviews, matched to the candidate's skills.
import http from '@/lib/http';

const C = '/candidates/me/ai-interviews';

export interface OpenInterview {
  id: string;
  title: string;
  companyName: string | null;
  description: string | null;
  requiredSkills: string[];
  experienceLevel: string | null;
  durationMinutes: number | null;
  interviewType: string;
  questionCount: number;
  status: 'OPEN';
  publishedAt: string;
  createdAt: string;
  /** True when the candidate's account email already took this interview. */
  alreadyTaken: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  matchPercent: number;
}

export interface OpenInterviewDetail extends OpenInterview {
  objective: string | null;
  language: string;
  instructions: string[];
}

export interface OpenInterviewList {
  candidateSkills: string[];
  /** Every open interview, before the skill filter. */
  total: number;
  interviews: OpenInterview[];
}

export const listOpenInterviews = async (all = false) => (await http.get<OpenInterviewList>(C, { params: all ? { all: true } : undefined })).data;
export const getOpenInterview = async (id: string) => (await http.get<OpenInterviewDetail>(`${C}/${id}`)).data;
/** 400 for a bad email, 409 "You already taken the interview" for a repeat of the same interview + email. */
export const attendOpenInterview = async (id: string, email: string) => (await http.post<{ sessionId: string }>(`${C}/${id}/attend`, { email })).data;
