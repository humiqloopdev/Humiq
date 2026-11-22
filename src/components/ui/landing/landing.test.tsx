import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('@/components/ui/layout', () => ({ PublicNav: () => <nav data-testid="nav" /> }));

import { IntroPlayer, INTRO_TEXT } from './intro-player';
import { CANDIDATE_STEPS, EMPLOYER_STEPS, FlowShowcase } from './flow-showcase';
import { LandingPage } from '@/components/ui/auth/landing-page';

// ── a controllable speechSynthesis ──
class FakeUtterance {
  text: string; lang = ''; rate = 1; pitch = 1; voice: unknown = null;
  onboundary: ((e: { charIndex: number }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) { this.text = text; }
}
let spoken: FakeUtterance[] = [];
const synth = { speak: vi.fn((u: FakeUtterance) => { spoken.push(u); }), cancel: vi.fn(), getVoices: vi.fn(() => [{ name: 'Google US English', lang: 'en-US' }]) };

const withSpeech = () => {
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;
};
const withoutSpeech = () => {
  // @ts-expect-error removing for the test
  delete window.speechSynthesis;
  delete (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
};

beforeEach(() => { vi.clearAllMocks(); spoken = []; vi.useFakeTimers({ shouldAdvanceTime: true }); window.location.hash = ''; });
afterEach(() => { vi.useRealTimers(); });

describe('IntroPlayer (Play button)', () => {
  it('offers a Play button and starts idle', () => {
    withSpeech();
    render(<IntroPlayer />);
    expect(screen.getByRole('button', { name: /play introduction/i })).toBeInTheDocument();
    expect(screen.getByText('AI Platform')).toBeInTheDocument();
    expect(screen.queryByText('Humiq Loop AI')).not.toBeInTheDocument(); // the introduction card only appears while it plays
    expect(synth.speak).not.toHaveBeenCalled(); // never autoplays: browsers need a click
  });

  it('the spoken text introduces Humiq Loop AI, technical and non-technical interviews and real-time reports', () => {
    expect(INTRO_TEXT).toMatch(/^Hello, I am Humiq Loop AI\./);
    expect(INTRO_TEXT).toMatch(/technical and non-technical/);
    expect(INTRO_TEXT).toMatch(/real-time interviewer/);
    expect(INTRO_TEXT).toMatch(/real-time reports/);
    expect(INTRO_TEXT).toMatch(/Thank you\.$/);
  });

  it('pressing Play speaks the introduction and shows Stop', async () => {
    withSpeech();
    render(<IntroPlayer />);
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0].text).toBe(INTRO_TEXT);
    expect(spoken[0].lang).toBe('en-US');
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByText('Speaking…')).toBeInTheDocument();
  });

  it('captions follow the voice (word boundaries), then the hero returns to the Play button', async () => {
    withSpeech();
    const { container } = render(<IntroPlayer />);
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    act(() => spoken[0].onboundary?.({ charIndex: 30 }));
    const live = container.querySelector('[aria-live=polite]')!;
    expect(live.children[0].textContent).toBe(INTRO_TEXT.slice(0, 30));
    act(() => { vi.advanceTimersByTime(20_000); spoken[0].onend?.(); });
    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(live.children[0].textContent).toBe(INTRO_TEXT);
    expect(screen.queryByRole('button', { name: /play introduction/i })).not.toBeInTheDocument(); // the Play button stays hidden until the card goes away
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(screen.getByRole('button', { name: /play introduction/i })).toBeInTheDocument();
    expect(screen.queryByText('Humiq Loop AI')).not.toBeInTheDocument();
  });

  it('pressing Play hides the Play button while the introduction runs', async () => {
    withSpeech();
    render(<IntroPlayer />);
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    expect(screen.queryByRole('button', { name: /play introduction/i })).not.toBeInTheDocument();
    expect(screen.getByText('Humiq Loop AI')).toBeInTheDocument();
  });

  it('Stop cancels the speech and returns to Play', async () => {
    withSpeech();
    render(<IntroPlayer />);
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /play introduction/i })).toBeInTheDocument();
  });

  it('can be played again after it has returned to the Play button', async () => {
    withSpeech();
    render(<IntroPlayer />);
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    act(() => { vi.advanceTimersByTime(20_000); spoken[0].onend?.(); });
    act(() => { vi.advanceTimersByTime(2_000); });
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });

  it('a stale end event from a stopped run does not finish a new run', async () => {
    withSpeech();
    render(<IntroPlayer />);
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    const first = spoken[0];
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    // past the "ended too fast" window, so only the run guard can stop this stale event from finishing the new run
    act(() => { vi.advanceTimersByTime(5_000); first.onend?.(); });
    expect(screen.getByText('Speaking…')).toBeInTheDocument();
  });

  it('NEGATIVE: a voice that "ends" instantly (no sound) does not skip the captions', async () => {
    withSpeech();
    render(<IntroPlayer />);
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    act(() => spoken[0].onend?.()); // fires right away
    expect(screen.getByText('Speaking…')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('NEGATIVE: an interrupted/cancelled utterance is not treated as finished', async () => {
    withSpeech();
    render(<IntroPlayer />);
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    act(() => spoken[0].onerror?.({ error: 'interrupted' }));
    expect(screen.getByText('Speaking…')).toBeInTheDocument();
  });

  it('NEGATIVE: browsers without speech still get the introduction as captions', async () => {
    withoutSpeech();
    render(<IntroPlayer />);
    expect(screen.getByText(/cannot play speech/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    expect(screen.getByText('Speaking…')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('leaving the page stops the speech', async () => {
    withSpeech();
    const { unmount } = render(<IntroPlayer />);
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe('FlowShowcase (employer and candidate sequences)', () => {
  it('starts on the employer journey with every step in order', () => {
    render(<FlowShowcase />);
    expect(screen.getByRole('tab', { name: /for employers/i })).toHaveAttribute('aria-selected', 'true');
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(EMPLOYER_STEPS.map((s) => s.title));
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument();
    expect(screen.getByText('Step 7 of 7')).toBeInTheDocument();
  });

  it('every step shows a screenshot with descriptive alt text', () => {
    render(<FlowShowcase />);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(EMPLOYER_STEPS.length);
    imgs.forEach((img) => { expect(img.getAttribute('alt')).toMatch(/.{12,}/); expect(img.getAttribute('src')).toMatch(/^\/landing\/emp-/); expect(img).toHaveAttribute('loading', 'lazy'); });
  });

  it('switches to the candidate journey', async () => {
    render(<FlowShowcase />);
    await userEvent.click(screen.getByRole('tab', { name: /for candidates/i }));
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(CANDIDATE_STEPS.map((s) => s.title));
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    screen.getAllByRole('img').forEach((img) => expect(img.getAttribute('src')).toMatch(/^\/landing\/cand-/));
  });

  it('the menu link #candidates opens the candidate tab (also when already on the page)', () => {
    render(<FlowShowcase />);
    act(() => { window.location.hash = '#candidates'; fireEvent(window, new HashChangeEvent('hashchange')); });
    expect(screen.getByRole('tab', { name: /for candidates/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('an initial #candidates hash starts on the candidate tab; an unknown hash is ignored', () => {
    window.location.hash = '#candidates';
    const { unmount } = render(<FlowShowcase />);
    expect(screen.getByRole('tab', { name: /for candidates/i })).toHaveAttribute('aria-selected', 'true');
    unmount();
    window.location.hash = '#nonsense';
    render(<FlowShowcase />);
    expect(screen.getByRole('tab', { name: /for employers/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('says the screens use sample data', () => {
    render(<FlowShowcase />);
    expect(screen.getByText(/sample data/i)).toBeInTheDocument();
  });
});

describe('LandingPage', () => {
  it('shows the headline, then the intro player below it and does not invent statistics', () => {
    withSpeech();
    render(<LandingPage />);
    const player = screen.getByTestId('intro-player');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.compareDocumentPosition(player) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/50,000|3,200|98%|\$85\/hr/);
  });

  it('has the sections the menu links point to', () => {
    withSpeech();
    const { container } = render(<LandingPage />);
    for (const id of ['how', 'employers', 'candidates', 'pricing']) expect(container.querySelector(`#${id}`)).not.toBeNull();
  });

  it('call-to-action buttons go to the right signup', async () => {
    withSpeech();
    render(<LandingPage />);
    await userEvent.click(screen.getAllByRole('button', { name: /start hiring with ai/i })[0]);
    expect(navigate).toHaveBeenCalledWith({ to: '/signup', search: { role: 'employer' } });
    await userEvent.click(screen.getAllByRole('button', { name: /take an interview/i })[0]);
    expect(navigate).toHaveBeenCalledWith({ to: '/signup', search: { role: 'candidate' } });
  });

  it('covers both technical and non-technical interviews', () => {
    withSpeech();
    render(<LandingPage />);
    expect(screen.getByText('Technical interviews')).toBeInTheDocument();
    expect(screen.getByText('Non-technical interviews')).toBeInTheDocument();
  });

  it('the FAQ answers can be opened', async () => {
    withSpeech();
    render(<LandingPage />);
    expect(screen.getByText(/each email address can take a given interview once/i)).toBeInTheDocument();
  });
});

describe('hero background', () => {
  it('is animated the whole time, and the text only appears after Play is pressed', async () => {
    withSpeech();
    render(<LandingPage />);
    const bg = screen.getByTestId('hero-background');
    expect(bg).toHaveAttribute('data-active', 'true');
    expect(screen.queryByText(/I can take interviews/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /play introduction/i }));
    expect(screen.getByText(/I can take interviews/, { exact: false })).toBeInTheDocument();
    expect(bg).toHaveAttribute('data-active', 'true');
    act(() => { vi.advanceTimersByTime(20_000); spoken[0].onend?.(); });
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(bg).toHaveAttribute('data-active', 'true');
    expect(screen.queryByText(/I can take interviews/)).not.toBeInTheDocument();
  });
});
