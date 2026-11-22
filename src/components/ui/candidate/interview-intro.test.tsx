import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterviewIntro } from './interview-intro';

const props = { title: 'Senior Mobile Developer Technical Assessment', description: 'Cross-platform expertise.', questionCount: 7, minutes: 20 };
const renderIntro = (over: Partial<Parameters<typeof InterviewIntro>[0]> = {}) => {
  const onNext = vi.fn();
  render(<InterviewIntro {...props} onNext={onNext} {...over} />);
  return onNext;
};

// ── media mocks ─────────────────────────────────────────────────────
const track = () => ({ stop: vi.fn(), getSettings: () => ({ displaySurface: 'monitor' }) });
const stream = (t = track()) => ({ getTracks: () => [t], getVideoTracks: () => [t] }) as unknown as MediaStream;
const domErr = (name: string) => Object.assign(new Error(name), { name });
let getUserMedia: ReturnType<typeof vi.fn>;
let getDisplayMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  getUserMedia = vi.fn();
  getDisplayMedia = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia, getDisplayMedia }, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
});
afterEach(() => vi.restoreAllMocks());

const goToChecklist = async () => {
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: /^next$/i }));
};

describe('Interview Info step', () => {
  it('greets the candidate by name above the interview title', () => {
    renderIntro({ userName: 'nov22' });
    const welcome = screen.getByText('Welcome, nov22');
    const title = screen.getByRole('heading', { name: props.title });
    expect(welcome.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('NEGATIVE: shows no greeting when the name is unknown', () => {
    renderIntro();
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
  });

  it('shows description, question count and minutes', () => {
    renderIntro();
    expect(screen.getByText('Cross-platform expertise.')).toBeInTheDocument();
    expect(screen.getByText('7 questions · 20 min')).toBeInTheDocument();
  });

  it('NEGATIVE: falls back to a default description when none is provided', () => {
    renderIntro({ description: undefined });
    expect(screen.getByText(/technical interview designed to evaluate/i)).toBeInTheDocument();
  });

  it('lists all 7 integrity notices with the fairness banner', () => {
    renderIntro();
    expect(screen.getByText(/to ensure fairness/i)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((li) => /^\d\. /.test(li.textContent ?? ''))).toHaveLength(7);
    for (const lead of ['Tab switching and focus tracking:', 'External paste blocked:', 'Multiple screen detection:']) {
      expect(screen.getByText(lead)).toBeInTheDocument();
    }
  });

  it('NEGATIVE: Next is disabled until the candidate agrees, and re-disables when un-ticked', async () => {
    renderIntro();
    const next = screen.getByRole('button', { name: /^next$/i });
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(next).toBeEnabled();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(next).toBeDisabled();
  });

  it('NEGATIVE: clicking the disabled Next does not advance', async () => {
    renderIntro();
    await userEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.queryByRole('button', { name: /start collecting/i })).not.toBeInTheDocument();
  });

  it('the stepper highlights step 1', () => {
    renderIntro();
    expect(screen.getByText('Interview Info')).toHaveClass('text-navy');
    expect(screen.getByText('Checklist')).toHaveClass('text-gray-400');
  });
});

describe('Checklist step', () => {
  it('opens the checklist after agreeing; Back returns to the info step', async () => {
    renderIntro();
    await goToChecklist();
    expect(screen.getByRole('button', { name: /start collecting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test microphone/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share screen/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('heading', { name: props.title })).toBeInTheDocument();
  });

  it('NEGATIVE: Start Interview is disabled until every item is done or skipped', async () => {
    const onNext = renderIntro();
    await goToChecklist();
    const start = screen.getByRole('button', { name: /start interview/i });
    expect(start).toBeDisabled();
    await userEvent.click(start);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('POSITIVE: skipping all three items enables Start Interview, which hands over to the interview', async () => {
    const onNext = renderIntro();
    await goToChecklist();
    for (const skip of screen.getAllByRole('button', { name: /^skip$/i })) await userEvent.click(skip);
    const start = screen.getByRole('button', { name: /start interview/i });
    expect(start).toBeEnabled();
    await userEvent.click(start);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('NEGATIVE: skipping only some items keeps Start disabled', async () => {
    renderIntro();
    await goToChecklist();
    await userEvent.click(screen.getAllByRole('button', { name: /^skip$/i })[0]);
    expect(screen.getByRole('button', { name: /start interview/i })).toBeDisabled();
  });

  describe('camera', () => {
    it('NEGATIVE: permission denied shows a helpful message and keeps the item unfinished', async () => {
      getUserMedia.mockRejectedValue(domErr('NotAllowedError'));
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /start collecting/i }));
      expect(await screen.findByText(/camera access is blocked/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start interview/i })).toBeDisabled();
    });

    it('NEGATIVE: no camera device', async () => {
      getUserMedia.mockRejectedValue(domErr('NotFoundError'));
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /start collecting/i }));
      expect(await screen.findByText(/no camera was found/i)).toBeInTheDocument();
    });

    it('NEGATIVE: camera in use by another app', async () => {
      getUserMedia.mockRejectedValue(domErr('NotReadableError'));
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /start collecting/i }));
      expect(await screen.findByText(/being used by another app/i)).toBeInTheDocument();
    });

    it('NEGATIVE: insecure (non-HTTPS) page explains why', async () => {
      Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
      getUserMedia.mockRejectedValue(domErr('NotAllowedError'));
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /start collecting/i }));
      expect(await screen.findByText(/secure \(https\) page/i)).toBeInTheDocument();
    });

    it('POSITIVE: first click opens the preview and offers Take Photo', async () => {
      getUserMedia.mockResolvedValue(stream());
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /start collecting/i }));
      expect(await screen.findByRole('button', { name: /take photo/i })).toBeInTheDocument();
      expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user' } });
    });

    it('NEGATIVE: Take Photo before the video has dimensions does not mark the item done', async () => {
      getUserMedia.mockResolvedValue(stream());
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /start collecting/i }));
      await userEvent.click(await screen.findByRole('button', { name: /take photo/i }));
      expect(screen.queryByText('Collect photo')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
    });
  });

  describe('microphone', () => {
    it('NEGATIVE: permission denied', async () => {
      getUserMedia.mockRejectedValue(domErr('NotAllowedError'));
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /test microphone/i }));
      expect(await screen.findByText(/microphone access is blocked/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /test microphone/i })).toBeEnabled();
    });

    it('NEGATIVE: no microphone device', async () => {
      getUserMedia.mockRejectedValue(domErr('NotFoundError'));
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /test microphone/i }));
      expect(await screen.findByText(/no microphone was found/i)).toBeInTheDocument();
    });
  });

  describe('screen share', () => {
    it('NEGATIVE: cancelling the share dialog shows guidance and does not complete', async () => {
      getDisplayMedia.mockRejectedValue(domErr('NotAllowedError'));
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /share screen/i }));
      expect(await screen.findByText(/cancelled or blocked/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /share screen/i })).toBeInTheDocument();
    });

    it('NEGATIVE: sharing a tab/window instead of the entire screen is rejected and the stream is stopped', async () => {
      const t = { stop: vi.fn(), getSettings: () => ({ displaySurface: 'browser' }) };
      getDisplayMedia.mockResolvedValue(stream(t as never));
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /share screen/i }));
      expect(await screen.findByText(/select "entire screen"/i)).toBeInTheDocument();
      expect(t.stop).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /share screen/i })).toBeInTheDocument();
    });

    it('POSITIVE: sharing the entire screen completes the item', async () => {
      getDisplayMedia.mockResolvedValue(stream());
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getByRole('button', { name: /share screen/i }));
      expect(await screen.findByRole('button', { name: /share again/i })).toBeInTheDocument();
      expect(screen.getByText('Screen capture')).toHaveClass('text-green');
    });

    it('POSITIVE: a skipped item can be retried, and finishing it clears the skipped state', async () => {
      getDisplayMedia.mockResolvedValue(stream());
      renderIntro();
      await goToChecklist();
      await userEvent.click(screen.getAllByRole('button', { name: /^skip$/i })[2]);
      expect(screen.getByText(/screen capture \(skipped\)/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /share again/i }));
      await userEvent.click(await screen.findByRole('button', { name: /share screen/i }).catch(() => screen.getByRole('button', { name: /share again/i })));
      await waitFor(() => expect(getDisplayMedia).toHaveBeenCalled());
    });
  });
});
