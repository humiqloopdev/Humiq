import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

const api = {
  getInvite: vi.fn(), getPublicInterview: vi.fn(), startInviteSession: vi.fn(), startSession: vi.fn(),
  getRoomSession: vi.fn(), chatTurn: vi.fn(), completeSession: vi.fn(), postMessage: vi.fn(),
  reportViolation: vi.fn(), setCurrentQuestion: vi.fn(),
};
vi.mock('@/api/aiInterviews/aiInterviewsApi', () => ({
  getInvite: (...a: unknown[]) => api.getInvite(...a),
  getPublicInterview: (...a: unknown[]) => api.getPublicInterview(...a),
  startInviteSession: (...a: unknown[]) => api.startInviteSession(...a),
  startSession: (...a: unknown[]) => api.startSession(...a),
  getRoomSession: (...a: unknown[]) => api.getRoomSession(...a),
  chatTurn: (...a: unknown[]) => api.chatTurn(...a),
  completeSession: (...a: unknown[]) => api.completeSession(...a),
  postMessage: (...a: unknown[]) => api.postMessage(...a),
  reportViolation: (...a: unknown[]) => api.reportViolation(...a),
  setCurrentQuestion: (...a: unknown[]) => api.setCurrentQuestion(...a),
}));
vi.mock('./ai-voice-room', () => ({ AiVoiceRoom: () => <div data-testid="voice-room" /> }));
vi.mock('./code-editor', () => ({
  CODE_LANGUAGES: [], languageLabel: (l: string) => l, CodeBlock: () => null, CodeEditor: () => null,
}));

import { AiJoin, AiRoom } from './ai-room';

const publicInterview = {
  id: 'i1', title: 'Senior Mobile Developer Technical Assessment', description: 'Cross-platform expertise.', aiName: 'MobileArch',
  questions: new Array(7).fill(0).map((_, i) => ({ id: `q${i}` })), timeLimitMinutes: 20, requireInvite: false,
};

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  vi.clearAllMocks();
  api.completeSession.mockResolvedValue({});
  api.setCurrentQuestion.mockResolvedValue({});
  api.reportViolation.mockResolvedValue({});
});

describe('AiJoin with a personal invite link', () => {
  it('skips the join card and goes straight to the session', async () => {
    api.getInvite.mockResolvedValue({ name: 'nov22', email: null, interview: publicInterview });
    api.startInviteSession.mockResolvedValue({ sessionId: 'sess-1' });
    wrap(<AiJoin token="tok" />);
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/i/session/$sessionId', params: { sessionId: 'sess-1' } }));
    expect(screen.queryByRole('button', { name: /start interview/i })).not.toBeInTheDocument();
  });

  it('starts the invite session exactly once', async () => {
    api.getInvite.mockResolvedValue({ name: 'nov22', email: null, interview: publicInterview });
    api.startInviteSession.mockResolvedValue({ sessionId: 'sess-1' });
    wrap(<AiJoin token="tok" />);
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(api.startInviteSession).toHaveBeenCalledTimes(1);
    expect(api.startInviteSession).toHaveBeenCalledWith('tok');
  });

  it('NEGATIVE: an invalid / expired invite shows an error and never starts a session', async () => {
    api.getInvite.mockRejectedValue({ response: { data: { message: 'Invite expired' } } });
    wrap(<AiJoin token="bad" />);
    expect(await screen.findByText(/expired|not valid/i)).toBeInTheDocument();
    expect(api.startInviteSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('NEGATIVE: if the session cannot be started the error shows with a Start button to retry', async () => {
    api.getInvite.mockResolvedValue({ name: 'nov22', email: null, interview: publicInterview });
    api.startInviteSession.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ sessionId: 'sess-2' });
    wrap(<AiJoin token="tok" />);
    const retry = await screen.findByRole('button', { name: /start interview/i });
    expect(screen.getByText(/senior mobile developer technical assessment/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    await userEvent.click(retry);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ params: { sessionId: 'sess-2' } })));
  });
});

describe('AiJoin with a public link (no invite)', () => {
  it('shows the join card and requires a name before starting', async () => {
    api.getPublicInterview.mockResolvedValue(publicInterview);
    wrap(<AiJoin slug="mobile" />);
    const start = await screen.findByRole('button', { name: /start interview/i });
    expect(start).toBeDisabled();
    expect(api.startSession).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/your name/i), 'Asha');
    expect(start).toBeEnabled();
    api.startSession.mockResolvedValue({ sessionId: 'sess-9' });
    await userEvent.click(start);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ params: { sessionId: 'sess-9' } })));
    expect(api.startSession).toHaveBeenCalledWith({ interviewSlug: 'mobile', participantName: 'Asha', participantEmail: undefined });
  });

  it('NEGATIVE: invite-only interviews also need an email', async () => {
    api.getPublicInterview.mockResolvedValue({ ...publicInterview, requireInvite: true });
    wrap(<AiJoin slug="mobile" />);
    const start = await screen.findByRole('button', { name: /start interview/i });
    await userEvent.type(screen.getByLabelText(/your name/i), 'Asha');
    expect(start).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    expect(start).toBeEnabled();
  });

  it('NEGATIVE: whitespace-only name keeps Start disabled', async () => {
    api.getPublicInterview.mockResolvedValue(publicInterview);
    wrap(<AiJoin slug="mobile" />);
    const start = await screen.findByRole('button', { name: /start interview/i });
    await userEvent.type(screen.getByLabelText(/your name/i), '   ');
    expect(start).toBeDisabled();
  });

  it('NEGATIVE: unknown interview link shows an error', async () => {
    api.getPublicInterview.mockRejectedValue(new Error('404'));
    wrap(<AiJoin slug="nope" />);
    expect(await screen.findByText(/not valid|no longer active|404/i)).toBeInTheDocument();
  });
});

const roomSession = (over: Record<string, unknown> = {}, interviewOver: Record<string, unknown> = {}) => ({
  id: 's1', status: 'IN_PROGRESS', participantName: 'nov22', currentQuestionId: 'q0', messages: [],
  interview: {
    ...publicInterview, objective: null, aiTone: 'friendly', language: 'en', followUpDepth: 'medium',
    antiCheatingEnabled: false, chatEnabled: true, voiceEnabled: true,
    questions: [{ id: 'q0', order: 0, text: 'Intro?', type: 'OPEN_ENDED', description: null, options: null, starterCode: null }],
    ...interviewOver,
  },
  ...over,
});

describe('AiRoom entry', () => {
  it('shows the briefing with the candidate name first, then lands directly in voice (no mode picker)', async () => {
    api.getRoomSession.mockResolvedValue(roomSession());
    wrap(<AiRoom sessionId="s1" />);
    expect(await screen.findByText('Welcome, nov22')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-room')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /^next$/i }));
    for (const skip of screen.getAllByRole('button', { name: /^skip$/i })) await userEvent.click(skip);
    await userEvent.click(screen.getByRole('button', { name: /start interview/i }));
    expect(await screen.findByTestId('voice-room')).toBeInTheDocument();
    expect(screen.queryByText(/how would you like to interview/i)).not.toBeInTheDocument();
  });

  it('NEGATIVE: the briefing cannot be bypassed - voice room is not rendered before it is completed', async () => {
    api.getRoomSession.mockResolvedValue(roomSession());
    wrap(<AiRoom sessionId="s1" />);
    await screen.findByText('Welcome, nov22');
    expect(screen.queryByTestId('voice-room')).not.toBeInTheDocument();
  });

  it('NEGATIVE: a session that cannot be loaded shows an error', async () => {
    api.getRoomSession.mockRejectedValue(new Error('Session not found'));
    wrap(<AiRoom sessionId="nope" />);
    expect(await screen.findByText(/session not found/i)).toBeInTheDocument();
  });

  it('a completed session shows the completion screen, not the briefing', async () => {
    api.getRoomSession.mockResolvedValue(roomSession({ status: 'COMPLETED' }));
    wrap(<AiRoom sessionId="s1" />);
    expect(await screen.findByText(/interview complete/i)).toBeInTheDocument();
    expect(screen.queryByText('Welcome, nov22')).not.toBeInTheDocument();
  });

  it('a resumed session skips the briefing', async () => {
    api.getRoomSession.mockResolvedValue(roomSession({ messages: [{ id: 'm', role: 'ASSISTANT', content: 'hi', contentType: 'TEXT' }] }, { voiceEnabled: false }));
    api.chatTurn.mockResolvedValue({ content: 'next', questionAdvanced: false, isComplete: false });
    wrap(<AiRoom sessionId="s1" />);
    expect(await screen.findByText('hi')).toBeInTheDocument();
    expect(screen.queryByText('Welcome, nov22')).not.toBeInTheDocument();
  });

  it('preview sessions skip the briefing (no camera / screen prompts)', async () => {
    api.getRoomSession.mockResolvedValue(roomSession());
    wrap(<AiRoom sessionId="s1" preview />);
    expect(await screen.findByTestId('voice-room')).toBeInTheDocument();
  });

  it('chat-only interviews do not open the voice room', async () => {
    api.getRoomSession.mockResolvedValue(roomSession({}, { voiceEnabled: false }));
    api.chatTurn.mockResolvedValue({ content: 'Hello there', questionAdvanced: false, isComplete: false });
    wrap(<AiRoom sessionId="s1" preview />);
    expect(await screen.findByText('Hello there')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-room')).not.toBeInTheDocument();
  });
});
