import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast, useToastStore } from './toastStore';

beforeEach(() => { vi.useFakeTimers(); useToastStore.setState({ toasts: [] }); });

describe('toast store', () => {
  it('shows an error toast and auto-dismisses it', () => {
    toast.error('Invalid email or password.');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ kind: 'error', message: 'Invalid email or password.' });
    vi.advanceTimersByTime(6001);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
  it('collapses an identical repeated message (double submit)', () => {
    toast.error('Same'); toast.error('Same');
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
  it('keeps different messages and caps the stack at 4', () => {
    for (let i = 0; i < 6; i++) toast.info(`m${i}`);
    expect(useToastStore.getState().toasts).toHaveLength(4);
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('m5');
  });
  it('can be dismissed manually', () => {
    toast.success('Saved');
    useToastStore.getState().dismiss(useToastStore.getState().toasts[0].id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
