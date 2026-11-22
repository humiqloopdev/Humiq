import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoomSession } from '@/api/aiInterviews/aiInterviewsApi';

// ── mocks ───────────────────────────────────────────────────────────
type VoiceState = Record<string, unknown>;
const voiceState: VoiceState = {};
const voiceFns = {
  connect: vi.fn(), disconnect: vi.fn(), startListening: vi.fn(), stopListening: vi.fn(),
  nextQuestion: vi.fn(), previousQuestion: vi.fn(), sendCodeUpdate: vi.fn(),
};
let voiceOpts: { onAIResponse?: (t: string) => void; onTranscript?: (t: string, f: boolean) => void; onError?: (e: string) => void } = {};

vi.mock('@/hooks/use-voice', () => ({
  useVoice: (opts: typeof voiceOpts) => { voiceOpts = opts; return { ...voiceState, ...voiceFns }; },
}));
const postMessage = vi.fn();
vi.mock('@/api/aiInterviews/aiInterviewsApi', () => ({ postMessage: (...a: unknown[]) => postMessage(...a) }));
vi.mock('./code-editor', () => ({
  CODE_LANGUAGES: [{ id: 'javascript', label: 'JavaScript' }],
  languageLabel: (l: string) => l,
  CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>,
  CodeEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { AiVoiceRoom } from './ai-voice-room';

// ── fixtures ────────────────────────────────────────────────────────
const q = (id: string, order: number, text: string, type = 'OPEN_ENDED', starterCode: unknown = null) =>
  ({ id, order, text, type, description: null, options: null, starterCode, weight: 1 });

const baseSession = (questions = [
  q('q1', 0, 'Describe a challenging mobile feature.'),
  q('q2', 1, 'Flatten a nested object.', 'CODING', { language: 'javascript', code: 'function flatten(o) {\n  // go\n}\n' }),
  q('q3', 2, 'How do you handle offline sync?'),
]) => ({
  id: 's1', currentQuestionId: questions[0].id, participantName: 'nov22', status: 'IN_PROGRESS', messages: [],
  interview: {
    id: 'i1', title: 'Senior Mobile Developer Technical Assessment', aiName: 'MobileArch', aiTone: 'friendly', language: 'en',
    followUpDepth: 'medium', objective: null, timeLimitMinutes: 20, questions,
  },
}) as unknown as RoomSession;

const setVoice = (over: VoiceState = {}) => {
  Object.keys(voiceState).forEach((k) => delete voiceState[k]);
  Object.assign(voiceState, {
    isConnected: true, isListening: true, isSpeaking: false, isProcessing: false, isTransitioning: false,
    isInterviewComplete: false, timeLimitExceeded: false, currentQuestionIndex: 0, totalQuestions: 3,
    userTranscript: '', aiTranscript: '', audioLevel: 0, transitionDirection: null,
  }, over);
};

beforeEach(() => {
  vi.clearAllMocks();
  voiceFns.connect.mockResolvedValue(undefined);
  voiceFns.startListening.mockResolvedValue(undefined);
  voiceFns.disconnect.mockResolvedValue(undefined);
  postMessage.mockResolvedValue({});
  setVoice();
});

const renderRoom = (session = baseSession(), onDone = vi.fn()) => ({ onDone, ...render(<AiVoiceRoom session={session} onDone={onDone} />) });
const submitBtn = () => screen.getByRole('button', { name: /submit code/i });

// ── before the interview starts ─────────────────────────────────────
describe('before connecting', () => {
  it('shows the intro, the avatar and a Start button; toolbar is disabled', () => {
    setVoice({ isConnected: false, isListening: false });
    renderRoom();
    expect(screen.getByRole('button', { name: /start voice interview/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /interviewer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mute/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /end/i })).toBeDisabled();
  });

  it('connects and starts listening on Start', async () => {
    setVoice({ isConnected: false, isListening: false });
    renderRoom();
    await userEvent.click(screen.getByRole('button', { name: /start voice interview/i }));
    expect(voiceFns.connect).toHaveBeenCalledTimes(1);
    expect(voiceFns.startListening).toHaveBeenCalledTimes(1);
  });

  it('NEGATIVE: shows an error and lets the candidate retry when the relay is unreachable', async () => {
    setVoice({ isConnected: false, isListening: false });
    voiceFns.connect.mockRejectedValueOnce(new Error('relay down'));
    renderRoom();
    await userEvent.click(screen.getByRole('button', { name: /start voice interview/i }));
    expect(await screen.findByText(/could not start the voice interview/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start voice interview/i })).toBeEnabled();
  });

  it('NEGATIVE: surfaces errors reported by the voice hook (e.g. relay closed before ready)', async () => {
    setVoice({ isConnected: false, isListening: false });
    renderRoom();
    act(() => voiceOpts.onError?.('Gemini voice relay closed before ready'));
    expect(await screen.findByText(/relay closed before ready/i)).toBeInTheDocument();
  });

  it('NEGATIVE: microphone permission denied surfaces as an error', async () => {
    setVoice({ isConnected: false, isListening: false });
    voiceFns.startListening.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    renderRoom();
    await userEvent.click(screen.getByRole('button', { name: /start voice interview/i }));
    expect(await screen.findByText(/microphone access is allowed/i)).toBeInTheDocument();
  });
});

// ── normal (non-coding) question ────────────────────────────────────
describe('regular question screen', () => {
  it('shows title, progress, question, status and transcript panel; no editor, no scroll container', () => {
    const { container } = renderRoom();
    expect(screen.getByText('Senior Mobile Developer Technical Assessment')).toBeInTheDocument();
    expect(screen.getByText('Q1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Describe a challenging mobile feature.')).toBeInTheDocument();
    expect(screen.getByText('Listening…')).toBeInTheDocument();
    expect(screen.queryByLabelText('editor')).not.toBeInTheDocument();
    expect(container.querySelector('main')).toHaveClass('overflow-hidden');
  });

  it('has no Chat button in the toolbar', () => {
    renderRoom();
    expect(screen.queryByRole('button', { name: /chat/i })).not.toBeInTheDocument();
  });

  it('highlights the question in yellow only while the AI is speaking', () => {
    setVoice({ isSpeaking: true, isListening: false });
    const { rerender } = renderRoom();
    const el = () => screen.getByText('Describe a challenging mobile feature.');
    expect(screen.getByText('MobileArch is speaking')).toBeInTheDocument();
    expect(el()).toHaveClass('bg-yellow-200');
    setVoice({ isSpeaking: false, isListening: true });
    rerender(<AiVoiceRoom session={baseSession()} onDone={vi.fn()} />);
    expect(el()).not.toHaveClass('bg-yellow-200');
  });

  it('shows Thinking and Muted statuses', () => {
    setVoice({ isProcessing: true, isListening: false });
    const { rerender } = renderRoom();
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
    setVoice({ isProcessing: false, isListening: false });
    rerender(<AiVoiceRoom session={baseSession()} onDone={vi.fn()} />);
    expect(screen.getByText('Mic is muted')).toBeInTheDocument();
  });

  it('streams conversation turns into the transcript', async () => {
    renderRoom();
    act(() => voiceOpts.onAIResponse?.('Welcome to the interview'));
    act(() => voiceOpts.onTranscript?.('Thanks, glad to be here', true));
    expect(await screen.findByText('Welcome to the interview')).toBeInTheDocument();
    expect(screen.getByText('Thanks, glad to be here')).toBeInTheDocument();
    expect(screen.getByText(/^You:/)).toBeInTheDocument();
  });

  it('ignores empty / interim transcripts', () => {
    renderRoom();
    act(() => voiceOpts.onTranscript?.('half a sent', false));
    act(() => voiceOpts.onAIResponse?.('   '));
    expect(screen.queryByText('half a sent')).not.toBeInTheDocument();
    expect(screen.getByText(/conversation will appear here/i)).toBeInTheDocument();
  });

  it('the transcript panel collapses and expands', async () => {
    renderRoom();
    expect(screen.getByText('Transcript')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Transcript'));
    expect(screen.queryByText('Transcript')).not.toBeInTheDocument();
  });

  it('shows time left and the progress bar width follows the question', () => {
    setVoice({ currentQuestionIndex: 1 });
    const { container } = renderRoom();
    expect(screen.getByText('Q2 / 3')).toBeInTheDocument();
    expect(screen.getByText(/20:00 left/)).toBeInTheDocument();
    const bar = container.querySelector('header .bg-green') as HTMLElement;
    expect(parseFloat(bar.style.width)).toBeCloseTo(66.67, 0);
  });
});

// ── toolbar ─────────────────────────────────────────────────────────
describe('toolbar controls', () => {
  it('Mute stops listening; Unmute starts it', async () => {
    const { rerender } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: /mute/i }));
    expect(voiceFns.stopListening).toHaveBeenCalled();
    setVoice({ isListening: false });
    rerender(<AiVoiceRoom session={baseSession()} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /unmute/i }));
    expect(voiceFns.startListening).toHaveBeenCalled();
  });

  it('Previous is disabled on the first question, Next on the last', () => {
    const { rerender } = renderRoom();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^next/i })).toBeEnabled();
    setVoice({ currentQuestionIndex: 2 });
    rerender(<AiVoiceRoom session={baseSession()} onDone={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled();
  });

  it('Next and Previous call the voice hook; both are blocked mid-transition', async () => {
    setVoice({ currentQuestionIndex: 1 });
    const { rerender } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: /^next/i }));
    await userEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(voiceFns.nextQuestion).toHaveBeenCalledTimes(1);
    expect(voiceFns.previousQuestion).toHaveBeenCalledTimes(1);
    setVoice({ currentQuestionIndex: 1, isTransitioning: true, transitionDirection: 'next' });
    rerender(<AiVoiceRoom session={baseSession()} onDone={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('NEGATIVE: End -> Cancel keeps the interview running', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onDone } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: /end/i }));
    expect(voiceFns.disconnect).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('End -> OK disconnects and finishes exactly once', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onDone } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: /end/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(voiceFns.disconnect).toHaveBeenCalledTimes(1);
  });

  it('finishes automatically when the interviewer completes the interview', async () => {
    setVoice({ isInterviewComplete: true });
    const { onDone } = renderRoom();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('finishes automatically when the server time limit is exceeded', async () => {
    setVoice({ timeLimitExceeded: true });
    const { onDone } = renderRoom();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });
});

// ── coding question ─────────────────────────────────────────────────
describe('coding question', () => {
  beforeEach(() => setVoice({ currentQuestionIndex: 1 }));

  it('puts the editor on top and shrinks the avatar below it', () => {
    renderRoom();
    const editor = screen.getByLabelText('editor');
    const avatar = screen.getByRole('img', { name: /interviewer/i });
    expect(editor.compareDocumentPosition(avatar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((avatar as HTMLElement).style.width).toBe('72px');
    expect(screen.queryByText(/current question/i)).not.toBeInTheDocument();
  });

  it('starts with the starter code loaded in the editor', () => {
    renderRoom();
    expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toContain('function flatten');
  });

  // The scenario you asked about
  it('NEGATIVE: Submit is disabled when the candidate has not typed anything, and nothing is sent', async () => {
    renderRoom();
    expect(submitBtn()).toBeDisabled();
    expect(screen.getByText(/write your solution/i)).toBeInTheDocument();
    await userEvent.click(submitBtn());
    expect(postMessage).not.toHaveBeenCalled();
    expect(screen.getByLabelText('editor')).toBeInTheDocument(); // still in the coding view
  });

  it('NEGATIVE: clearing the editor disables Submit again', async () => {
    renderRoom();
    await userEvent.type(screen.getByLabelText('editor'), ' return 1;');
    expect(submitBtn()).toBeEnabled();
    await userEvent.clear(screen.getByLabelText('editor'));
    expect(submitBtn()).toBeDisabled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('NEGATIVE: whitespace-only edits do not enable Submit', async () => {
    renderRoom();
    await userEvent.type(screen.getByLabelText('editor'), '   ');
    expect(submitBtn()).toBeDisabled();
  });

  it('POSITIVE: submits written code, saves it as a CODE message, then returns to the normal screen', async () => {
    renderRoom();
    await userEvent.clear(screen.getByLabelText('editor'));
    await userEvent.type(screen.getByLabelText('editor'), 'const flat = (o) => o;');
    await userEvent.click(submitBtn());
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    expect(postMessage).toHaveBeenCalledWith('s1', expect.objectContaining({
      contentType: 'CODE', questionId: 'q2', content: 'const flat = (o) => o;',
      whiteboardData: expect.objectContaining({ language: 'javascript', code: 'const flat = (o) => o;' }),
    }));
    // old screen is back: large avatar, question text, no editor
    await waitFor(() => expect(screen.queryByLabelText('editor')).not.toBeInTheDocument());
    expect(screen.getByText(/current question/i)).toBeInTheDocument();
    expect(screen.getByText('Flatten a nested object.')).toBeInTheDocument();
    expect((screen.getByRole('img', { name: /interviewer/i }) as HTMLElement).style.width).not.toBe('72px');
    expect(screen.getByText(/Submitted javascript code for question 2/)).toBeInTheDocument();
  });

  it('NEGATIVE: if saving fails the editor stays, the code is kept, an error shows, and the candidate can retry', async () => {
    postMessage.mockRejectedValueOnce(new Error('network'));
    renderRoom();
    await userEvent.type(screen.getByLabelText('editor'), ' // mine');
    await userEvent.click(submitBtn());
    expect(await screen.findByText(/could not save your code|network/i)).toBeInTheDocument();
    const editor = screen.getByLabelText('editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('// mine');
    expect(submitBtn()).toBeEnabled();
    await userEvent.click(submitBtn());
    await waitFor(() => expect(screen.queryByLabelText('editor')).not.toBeInTheDocument());
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it('NEGATIVE: double-clicking Submit sends the code only once', async () => {
    let resolve!: () => void;
    postMessage.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
    renderRoom();
    await userEvent.type(screen.getByLabelText('editor'), ' // x');
    await userEvent.dblClick(submitBtn());
    expect(postMessage).toHaveBeenCalledTimes(1);
    resolve();
  });

  it('streams editor changes to the voice agent (debounced) while connected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderRoom();
    await userEvent.type(screen.getByLabelText('editor'), ' // hi');
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(voiceFns.sendCodeUpdate).toHaveBeenCalled();
    expect(voiceFns.sendCodeUpdate.mock.calls.at(-1)?.[0]).toContain('// hi');
    vi.useRealTimers();
  });

  it('highlights the spoken question in yellow beside the small avatar', () => {
    setVoice({ currentQuestionIndex: 1, isSpeaking: true, isListening: false });
    renderRoom();
    const strip = screen.getAllByText('Flatten a nested object.').find((e) => e.className.includes('bg-yellow-200'));
    expect(strip).toBeTruthy();
  });

  it('moving to the next question and back keeps a submitted question in the normal view', async () => {
    const { rerender } = renderRoom();
    await userEvent.type(screen.getByLabelText('editor'), ' // done');
    await userEvent.click(submitBtn());
    await waitFor(() => expect(screen.queryByLabelText('editor')).not.toBeInTheDocument());
    setVoice({ currentQuestionIndex: 2 });
    rerender(<AiVoiceRoom session={baseSession()} onDone={vi.fn()} />);
    setVoice({ currentQuestionIndex: 1 });
    rerender(<AiVoiceRoom session={baseSession()} onDone={vi.fn()} />);
    expect(screen.queryByLabelText('editor')).not.toBeInTheDocument();
  });

  it('a coding question with no starter code falls back to a default stub that also cannot be submitted untouched', () => {
    const session = baseSession([q('q1', 0, 'Intro'), q('q2', 1, 'Code something', 'CODING', null)]);
    setVoice({ currentQuestionIndex: 1, totalQuestions: 2 });
    renderRoom(session);
    expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toContain('Your code here');
    expect(submitBtn()).toBeDisabled();
  });
});
