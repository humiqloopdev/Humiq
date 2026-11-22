import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useToastStore } from '@/store/toastStore';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate, Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock('@/components/ui/layout', () => ({ CandidateShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { email: 'me@example.com' } }) }));

const api = { listOpenInterviews: vi.fn(), getOpenInterview: vi.fn(), attendOpenInterview: vi.fn() };
vi.mock('@/api/aiInterviews/openInterviewsApi', () => ({
  listOpenInterviews: (...a: unknown[]) => api.listOpenInterviews(...a),
  getOpenInterview: (...a: unknown[]) => api.getOpenInterview(...a),
  attendOpenInterview: (...a: unknown[]) => api.attendOpenInterview(...a),
}));

import { OpenInterviewsPage } from './open-interviews-page';
import { OpenInterviewDetailPage, isValidEmail } from './open-interview-detail-page';

const iv = (over = {}) => ({
  id: 'i1', title: 'Senior React Developer', companyName: 'ABC Technologies', description: 'Build great UIs.', requiredSkills: ['React', 'GraphQL'],
  experienceLevel: 'Senior', durationMinutes: 25, interviewType: 'Voice or text chat', questionCount: 6, status: 'OPEN' as const,
  publishedAt: '2026-11-20T10:00:00.000Z', createdAt: '2026-11-19T10:00:00.000Z', alreadyTaken: false,
  matchedSkills: ['React'], missingSkills: ['GraphQL'], matchPercent: 50, ...over,
});
const detail = (over = {}) => ({ ...iv(), objective: 'Check React depth.', language: 'en', instructions: ['The interview takes about 25 minutes.', 'Use the latest Chrome.'], ...over });

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const chip = (name: string) => screen.getAllByText(name).find((e) => e.className.includes('rounded-full'))!;
const toasts = () => useToastStore.getState().toasts.map((t) => t.message);

beforeEach(() => { vi.clearAllMocks(); useToastStore.setState({ toasts: [] }); });

describe('Open Interviews listing', () => {
  it('shows each interview with the details the spec asks for', async () => {
    api.listOpenInterviews.mockResolvedValue({ candidateSkills: ['React'], total: 1, interviews: [iv()] });
    wrap(<OpenInterviewsPage />);
    expect(await screen.findByText('Senior React Developer')).toBeInTheDocument();
    expect(screen.getByText('ABC Technologies')).toBeInTheDocument();
    expect(screen.getByText('Build great UIs.')).toBeInTheDocument();
    expect(chip('React')).toBeInTheDocument();
    expect(chip('GraphQL')).toBeInTheDocument();
    expect(screen.getByText('25 min')).toBeInTheDocument();
    expect(screen.getByText('Voice or text chat')).toBeInTheDocument();
    expect(screen.getByText('Senior')).toBeInTheDocument();
    expect(screen.getByText(/Published Nov 20, 2026/)).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('50% match')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
  });

  it('highlights matched skills differently from missing ones', async () => {
    api.listOpenInterviews.mockResolvedValue({ candidateSkills: ['React'], total: 1, interviews: [iv()] });
    wrap(<OpenInterviewsPage />);
    await screen.findByText('Senior React Developer');
    expect(chip('React').className).toMatch(/green/);
    expect(chip('GraphQL').className).not.toMatch(/green/);
  });

  it('opens the details page for the clicked interview', async () => {
    api.listOpenInterviews.mockResolvedValue({ candidateSkills: ['React'], total: 1, interviews: [iv()] });
    wrap(<OpenInterviewsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /view details/i }));
    expect(navigate).toHaveBeenCalledWith({ to: '/candidate/open-interviews/$interviewId', params: { interviewId: 'i1' } });
  });

  it('NEGATIVE: tells the candidate when nothing matches, and offers to show everything', async () => {
    api.listOpenInterviews.mockResolvedValue({ candidateSkills: ['Go'], total: 3, interviews: [] });
    wrap(<OpenInterviewsPage />);
    expect(await screen.findByText('No interviews match your skills yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(api.listOpenInterviews).toHaveBeenLastCalledWith(true));
  });

  it('NEGATIVE: empty state when no interview is open at all', async () => {
    api.listOpenInterviews.mockResolvedValue({ candidateSkills: [], total: 0, interviews: [] });
    wrap(<OpenInterviewsPage />);
    expect(await screen.findByText('No open interviews right now')).toBeInTheDocument();
    expect(screen.getByText(/Add skills to your profile/i)).toBeInTheDocument();
  });

  it('NEGATIVE: shows an error when the list cannot be loaded', async () => {
    api.listOpenInterviews.mockRejectedValue(new Error('down'));
    wrap(<OpenInterviewsPage />);
    expect(await screen.findByText(/could not load interviews/i)).toBeInTheDocument();
  });

  it('flags an interview the candidate has already taken', async () => {
    api.listOpenInterviews.mockResolvedValue({ candidateSkills: ['React'], total: 1, interviews: [iv({ alreadyTaken: true })] });
    wrap(<OpenInterviewsPage />);
    expect(await screen.findByText(/you have taken this interview/i)).toBeInTheDocument();
  });
});

describe('Interview details + attend', () => {
  it('shows the full details before the candidate starts', async () => {
    api.getOpenInterview.mockResolvedValue(detail());
    wrap(<OpenInterviewDetailPage interviewId="i1" />);
    expect(await screen.findByRole('heading', { name: 'Senior React Developer' })).toBeInTheDocument();
    expect(screen.getByText('Build great UIs.')).toBeInTheDocument();
    expect(screen.getByText('Check React depth.')).toBeInTheDocument();
    expect(screen.getByText('The interview takes about 25 minutes.')).toBeInTheDocument();
    expect(screen.getByText(/Experience level:/).closest('p')).toHaveTextContent('Experience level: Senior');
    expect(screen.getByRole('button', { name: /attend interview/i })).toBeInTheDocument();
  });

  it('prefills the account email', async () => {
    api.getOpenInterview.mockResolvedValue(detail());
    wrap(<OpenInterviewDetailPage interviewId="i1" />);
    expect(await screen.findByLabelText('Email address')).toHaveValue('me@example.com');
  });

  it('Scenario 1: valid email, first time -> opens the interview session', async () => {
    api.getOpenInterview.mockResolvedValue(detail());
    api.attendOpenInterview.mockResolvedValue({ sessionId: 's-1' });
    wrap(<OpenInterviewDetailPage interviewId="i1" />);
    const email = await screen.findByLabelText('Email address');
    await userEvent.clear(email);
    await userEvent.type(email, '  New.Person@Example.com ');
    await userEvent.click(screen.getByRole('button', { name: /attend interview/i }));
    await waitFor(() => expect(api.attendOpenInterview).toHaveBeenCalledWith('i1', 'New.Person@Example.com'));
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/i/session/$sessionId', params: { sessionId: 's-1' } }));
    expect(toasts()).toEqual([]);
  });

  it('Scenario 2: duplicate -> toast with the exact message and NO navigation', async () => {
    api.getOpenInterview.mockResolvedValue(detail());
    api.attendOpenInterview.mockRejectedValue({ response: { status: 409, data: { message: 'You already taken the interview' } } });
    wrap(<OpenInterviewDetailPage interviewId="i1" />);
    await userEvent.click(await screen.findByRole('button', { name: /attend interview/i }));
    await waitFor(() => expect(toasts()).toContain('You already taken the interview'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Scenario 2: even if the server body is missing, a 409 still shows the exact message', async () => {
    api.getOpenInterview.mockResolvedValue(detail());
    api.attendOpenInterview.mockRejectedValue({ response: { status: 409, data: {} } });
    wrap(<OpenInterviewDetailPage interviewId="i1" />);
    await userEvent.click(await screen.findByRole('button', { name: /attend interview/i }));
    await waitFor(() => expect(toasts()).toEqual(['You already taken the interview']));
  });

  it('NEGATIVE: an invalid email is rejected on the page and never sent to the server', async () => {
    api.getOpenInterview.mockResolvedValue(detail());
    wrap(<OpenInterviewDetailPage interviewId="i1" />);
    const email = await screen.findByLabelText('Email address');
    await userEvent.clear(email);
    await userEvent.type(email, 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /attend interview/i }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(api.attendOpenInterview).not.toHaveBeenCalled();
  });

  it('NEGATIVE: an empty email is rejected', async () => {
    api.getOpenInterview.mockResolvedValue(detail());
    wrap(<OpenInterviewDetailPage interviewId="i1" />);
    const email = await screen.findByLabelText('Email address');
    await userEvent.clear(email);
    await userEvent.click(screen.getByRole('button', { name: /attend interview/i }));
    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(api.attendOpenInterview).not.toHaveBeenCalled();
  });

  it('NEGATIVE: double-clicking Attend sends only one request', async () => {
    api.getOpenInterview.mockResolvedValue(detail());
    let resolve!: (v: { sessionId: string }) => void;
    api.attendOpenInterview.mockReturnValue(new Promise((r) => { resolve = r; }));
    wrap(<OpenInterviewDetailPage interviewId="i1" />);
    const btn = await screen.findByRole('button', { name: /attend interview/i });
    await userEvent.dblClick(btn);
    expect(api.attendOpenInterview).toHaveBeenCalledTimes(1);
    resolve({ sessionId: 's-1' });
  });

  it('other server errors are shown as a toast too', async () => {
    api.getOpenInterview.mockResolvedValue(detail());
    api.attendOpenInterview.mockRejectedValue({ response: { status: 404, data: { message: 'This interview is no longer open.' } } });
    wrap(<OpenInterviewDetailPage interviewId="i1" />);
    await userEvent.click(await screen.findByRole('button', { name: /attend interview/i }));
    await waitFor(() => expect(toasts()).toContain('This interview is no longer open.'));
  });

  it('NEGATIVE: an interview that is no longer open shows a clear message', async () => {
    api.getOpenInterview.mockRejectedValue({ response: { status: 404 } });
    wrap(<OpenInterviewDetailPage interviewId="gone" />);
    expect(await screen.findByText('This interview is no longer open')).toBeInTheDocument();
  });
});

describe('isValidEmail (page-side check)', () => {
  it.each(['a@b.co', ' x.y+z@mail.example.org '])('accepts %j', (e) => expect(isValidEmail(e)).toBe(true));
  it.each(['', 'a', 'a@b', '@b.co', 'a b@c.co', 'a@b..co'])('rejects %j', (e) => expect(isValidEmail(e)).toBe(false));
});
