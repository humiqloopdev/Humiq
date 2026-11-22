// src/api/aiInterviews/aiInterviewsApi.ts
// Employer-side AI Interviews and the public, login-free candidate endpoints.
import http from '@/lib/http';

const E = '/employers/me/ai';
const P = '/public/ai';
const data = async <T,>(p: Promise<{ data: T }>): Promise<T> => (await p).data;

/* ── Shapes ─────────────────────────────────────────────────── */
export type QuestionType = 'OPEN_ENDED' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'CODING' | 'WHITEBOARD' | 'RESEARCH';
export type AiTone = 'CASUAL' | 'PROFESSIONAL' | 'FORMAL' | 'FRIENDLY';
export type FollowUpDepth = 'LIGHT' | 'MODERATE' | 'DEEP';
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export interface AiQuestion {
  id: string;
  interviewId: string;
  order: number;
  text: string;
  description: string | null;
  type: QuestionType;
  options: { options: string[]; allowMultiple?: boolean } | null;
  starterCode: { language: string; code: string } | null;
  followUpPrompts: string[] | null;
  probeOnShort: boolean;
  timeLimitSeconds: number | null;
  isRequired: boolean;
}

export interface AiInterview {
  id: string;
  title: string;
  description: string | null;
  objective: string | null;
  assessmentCriteria: { name: string; description: string }[] | null;
  aiName: string;
  aiPersona: string | null;
  aiTone: AiTone;
  followUpDepth: FollowUpDepth;
  language: string;
  isActive: boolean;
  timeLimitMinutes: number | null;
  publicSlug: string | null;
  requireInvite: boolean;
  chatEnabled: boolean;
  voiceEnabled: boolean;
  videoEnabled: boolean;
  antiCheatingEnabled: boolean;
  /** Skills a candidate needs; used to match the interview to candidates' profiles. */
  requiredSkills?: string[];
  experienceLevel?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: AiQuestion[];
  _count?: { questions?: number; sessions?: number };
}

export interface AiMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  contentType: string;
  timestamp: string;
  /** 'chat' when typed during a voice interview; null for spoken turns. */
  transcription?: string | null;
  /** For CODE messages: { label, code, language }. */
  whiteboardData?: { label?: string; code?: string; language?: string; [k: string]: unknown } | null;
  questionId?: string | null;
  isFollowUp?: boolean;
}

/** One analysed question: the backend writes `evaluation` / `highlights` / `improvements`; older rows used `feedback`. */
export interface AiQuestionEvaluation {
  question?: string;
  score: number;
  evaluation?: string;
  feedback?: string;
  rationale?: string;
  highlights?: string[];
  improvements?: string[];
}

export interface AiToneAnalysis {
  overall?: string;
  details?: string;
  segments?: { question?: string; tone?: string; confidence?: string; notes?: string }[];
}

export interface AiResearchFinding {
  question?: string;
  summary?: string;
  keyTopics?: { topic: string; details: string }[];
  dataPoints?: string[];
}

export interface AiSession {
  id: string;
  interviewId: string;
  participantName: string | null;
  participantEmail: string | null;
  status: SessionStatus;
  modeUsed: 'CHAT' | 'VOICE' | 'HYBRID';
  summary: string | null;
  themes: string[];
  sentiment: { overall?: string; details?: string; [k: string]: unknown } | null;
  insights: {
    keyInsights?: string[];
    notableQuotes?: string[];
    criteriaEvaluations?: { name?: string; criterion?: string; score: number; rationale?: string; reasoning?: string; evidence?: string }[];
    questionEvaluations?: AiQuestionEvaluation[];
    toneAnalysis?: AiToneAnalysis;
    researchFindings?: AiResearchFinding[];
  } | null;
  startedAt: string;
  completedAt: string | null;
  totalDurationSeconds: number | null;
  antiCheatingLog: { type: string; timestamp: number; detail?: string }[] | null;
  createdAt: string;
  interview?: { id: string; title: string };
  _count?: { messages: number };
}

export interface AiCandidate {
  id: string;
  interviewId: string;
  name: string;
  email: string | null;
  phone: string | null;
  gender?: string | null;
  birthday?: string | null;
  education?: string | null;
  school?: string | null;
  major?: string | null;
  graduationYear?: number | null;
  workExperience?: string | null;
  notes: string | null;
  inviteToken: string | null;
  sessionId: string | null;
  createdAt: string;
  interview?: { id: string; title: string };
  session?: AiSession | null;
}

export interface AiDashboard {
  totalInterviews: number;
  totalSessions: number;
  totalQuestions: number;
  totalDuration: number;
  totalMessages: number;
  completionRate: number;
  avgSessionDuration: number;
  avgMessagesPerSession: number;
  daily: { date: string; sessions: number; sessionMinutes: number; messages: number; interviews: number; questions: number }[];
  questionTypeBreakdown: Record<QuestionType, number>;
  statusBreakdown: { COMPLETED: number; IN_PROGRESS: number; NOT_STARTED: number };
  topThemes: { theme: string; count: number }[];
  recentSessions: { id: string; interviewId: string; name: string; status: string; duration: number; messages: number; date: string; score: number | null }[];
}

export interface AiTemplate {
  id: string;
  title: string;
  description: string;
  objective: string;
  questions: { text: string; type: QuestionType }[];
  voiceEnabled: boolean;
  timeLimitMinutes?: number;
}

/* ── Employer ───────────────────────────────────────────────── */
export const getDashboard = () => data<AiDashboard>(http.get(`${E}/dashboard`));
export const getTemplates = () => data<AiTemplate[]>(http.get(`${E}/templates`));

export const listInterviews = () => data<{ interviews: AiInterview[] }>(http.get(`${E}/interviews`));
export const getInterview = (id: string) => data<AiInterview>(http.get(`${E}/interviews/${id}`));
export const createInterview = (body: Omit<Partial<AiInterview>, 'questions'> & { questions?: Partial<AiQuestion>[] }) => data<AiInterview>(http.post(`${E}/interviews`, body));
export const createFromTemplate = (templateId: string) => data<AiInterview>(http.post(`${E}/interviews/from-template`, { templateId }));
export const updateInterview = (id: string, body: Partial<AiInterview>) => data<AiInterview>(http.patch(`${E}/interviews/${id}`, body));
export const deleteInterview = (id: string) => data(http.delete(`${E}/interviews/${id}`));
export const deleteInterviews = (ids: string[]) => data(http.post(`${E}/interviews/delete-many`, { ids }));
export const duplicateInterview = (id: string) => data<AiInterview>(http.post(`${E}/interviews/${id}/duplicate`));
export const publishInterview = (id: string) => data<{ slug: string }>(http.post(`${E}/interviews/${id}/publish`));
export const unpublishInterview = (id: string) => data(http.post(`${E}/interviews/${id}/unpublish`));
export const createPreviewSession = (id: string) => data<{ sessionId: string; slug: string }>(http.post(`${E}/interviews/${id}/preview-session`));

export const addQuestion = (interviewId: string, body: Partial<AiQuestion>) => data<AiQuestion>(http.post(`${E}/interviews/${interviewId}/questions`, body));
export const updateQuestion = (id: string, body: Partial<AiQuestion>) => data<AiQuestion>(http.patch(`${E}/questions/${id}`, body));
export const deleteQuestion = (id: string) => data(http.delete(`${E}/questions/${id}`));
export const reorderQuestions = (interviewId: string, questionIds: string[]) => data(http.put(`${E}/interviews/${interviewId}/questions/order`, { questionIds }));

export const listCandidates = (interviewId: string) => data<{ candidates: AiCandidate[] }>(http.get(`${E}/interviews/${interviewId}/candidates`));
export const listAllCandidates = () => data<{ candidates: AiCandidate[] }>(http.get(`${E}/candidates`));
export const addCandidate = (interviewId: string, body: Partial<AiCandidate>) => data<AiCandidate>(http.post(`${E}/interviews/${interviewId}/candidates`, body));
/** Existing invite flow plus email: creates (or reuses) the personal link and emails it to the address. */
export interface InviteResult { candidate: AiCandidate; inviteUrl: string; emailSent: boolean; emailError: string | null }
export const inviteByEmail = (interviewId: string, body: { name?: string; email: string }) =>
  data<InviteResult>(http.post(`${E}/interviews/${interviewId}/invite`, body));
export const addCandidates = (interviewId: string, candidates: Partial<AiCandidate>[]) =>
  data<{ created: number; total: number }>(http.post(`${E}/interviews/${interviewId}/candidates/bulk`, { candidates }));
export const deleteCandidates = (ids: string[]) => data(http.post(`${E}/candidates/delete-many`, { ids }));

export const listSessions = (params?: { interviewId?: string; status?: string }) => data<{ sessions: AiSession[] }>(http.get(`${E}/sessions`, { params }));
export const getSession = (id: string) =>
  data<AiSession & { interviewTitle: string; interviewObjective: string | null; messages: AiMessage[] }>(http.get(`${E}/sessions/${id}`));
export const summarizeSession = (id: string) => data(http.post(`${E}/sessions/${id}/summarize`));
export const deleteSessions = (ids: string[]) => data(http.post(`${E}/sessions/delete-many`, { ids }));

/* ── Public (candidate) ─────────────────────────────────────── */
export interface PublicInterview extends AiInterview {
  questions: AiQuestion[];
}
export interface RoomSession {
  id: string;
  status: SessionStatus;
  currentQuestionId: string | null;
  participantName: string | null;
  interview: PublicInterview;
  messages: AiMessage[];
}

export const getPublicInterview = (slug: string) => data<PublicInterview>(http.get(`${P}/interviews/${slug}`));
export const getInvite = (token: string) => data<{ name: string; email: string | null; interview: PublicInterview }>(http.get(`${P}/invites/${token}`));
export const startSession = (body: { interviewSlug: string; participantName?: string; participantEmail?: string }) =>
  data<{ sessionId: string; interview: PublicInterview }>(http.post(`${P}/sessions`, body));
export const startInviteSession = (inviteToken: string) =>
  data<{ sessionId: string; interview: PublicInterview; isExisting: boolean }>(http.post(`${P}/sessions/invite`, { inviteToken }));
export const getRoomSession = (id: string) => data<RoomSession>(http.get(`${P}/sessions/${id}`));
export const postMessage = (id: string, body: { content: string; contentType?: string; questionId?: string; internal?: boolean; whiteboardData?: { label?: string; language?: string; code?: string } }) =>
  data<{ userMessage: AiMessage }>(http.post(`${P}/sessions/${id}/messages`, body));
export const chatTurn = (id: string, body: { messages: { role: 'user' | 'assistant'; content: string }[]; currentQuestionIndex: number; manualNavigation?: boolean }) =>
  data<{ content: string; questionAdvanced: boolean; isComplete: boolean }>(http.post(`${P}/sessions/${id}/chat`, body));
export const setCurrentQuestion = (id: string, questionId: string) => data(http.post(`${P}/sessions/${id}/current-question`, { questionId }));
export const completeSession = (id: string) => data(http.post(`${P}/sessions/${id}/complete`));
export const reportViolation = (id: string, violation: { type: string; timestamp: number; detail?: string }) =>
  data(http.post(`${P}/sessions/${id}/anti-cheating`, violation));

/* ── AI generator ───────────────────────────────────────────── */
export interface GeneratedQuestion {
  order: number;
  text: string;
  type: QuestionType;
  description?: string | null;
  timeLimitSeconds?: number | null;
  isRequired: boolean;
  options?: { options: string[]; allowMultiple?: boolean } | null;
  followUpPrompts?: string[] | null;
  starterCode?: { language: string; code: string } | null;
}

export interface GeneratedInterview {
  title: string;
  description: string;
  objective: string;
  assessmentCriteria: { name: string; description: string }[];
  estimatedDurationMinutes: number;
  questions: GeneratedQuestion[];
  recommendedSettings: { aiName: string; aiTone?: AiTone; followUpDepth?: FollowUpDepth };
}

export type StreamEvent =
  | { type: 'thinking' | 'content'; text: string }
  | { type: 'status'; message: string }
  | { type: 'done'; data: GeneratedInterview }
  | { type: 'error'; message: string };

/** Text of a job description / resume from a PDF or a URL. */
export const extractText = async (source: { file?: File; url?: string }) => {
  const form = new FormData();
  if (source.file) form.append('file', source.file);
  if (source.url) form.append('url', source.url);
  return (await http.post<{ text: string }>(`${E}/extract-text`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.text;
};

/**
 * Calls generate/refine, which answer with server-sent events (axios cannot stream in the browser, so this uses fetch).
 * Resolves with the finished interview structure; `onEvent` receives the live thinking/writing text.
 */
export async function streamInterview(
  kind: 'generate' | 'refine',
  body: Record<string, unknown>,
  onEvent: (e: StreamEvent) => void,
): Promise<GeneratedInterview> {
  const res = await fetch(`${http.defaults.baseURL}${E}/${kind}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    const message = Array.isArray(err.message) ? err.message.join(', ') : err.message;
    throw { response: { status: res.status, data: { detail: message ?? 'Generation failed' } } };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: GeneratedInterview | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const event = JSON.parse(line.slice(6)) as StreamEvent;
      if (event.type === 'error') throw { response: { status: 502, data: { detail: event.message } } };
      if (event.type === 'done') result = event.data;
      onEvent(event);
    }
  }
  if (!result) throw { response: { status: 502, data: { detail: 'No result received from the AI provider.' } } };
  return result;
}

export const listAllQuestions = () =>
  data<(AiQuestion & { interview: { id: string; title: string } })[]>(http.get(`${E}/questions`));
