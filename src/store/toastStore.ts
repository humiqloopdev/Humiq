// src/store/toastStore.ts
// Tiny toast queue. Call toast.error('...') / toast.success('...') from anywhere; <Toaster /> renders them.
import { create } from 'zustand';

export type ToastKind = 'error' | 'success' | 'info';
export interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string, ms?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message, ms = 6000) => {
    // The same message shown twice in a row (e.g. a double submit) collapses into one toast.
    if (get().toasts.some((t) => t.kind === kind && t.message === message)) return;
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message }] }));
    window.setTimeout(() => get().dismiss(id), ms);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  error: (message: string, ms?: number) => useToastStore.getState().push('error', message, ms),
  success: (message: string, ms?: number) => useToastStore.getState().push('success', message, ms),
  info: (message: string, ms?: number) => useToastStore.getState().push('info', message, ms),
};
