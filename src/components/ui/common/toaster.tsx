// src/components/ui/common/toaster.tsx
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type ToastKind } from '@/store/toastStore';
import { cn } from '@/lib/utils';

const STYLE: Record<ToastKind, { box: string; icon: ReactNode }> = {
  error: { box: 'border-red/30 text-red', icon: <AlertTriangle size={18} /> },
  success: { box: 'border-green-lt text-green-dk', icon: <CheckCircle2 size={18} /> },
  info: { box: 'border-blue/20 text-blue', icon: <Info size={18} /> },
};

/** Mount once near the root; shows toasts from the toast store in the top-right corner. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)] pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
          className={cn('page-enter pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg', STYLE[t.kind].box)}>
          <span className="mt-0.5 shrink-0">{STYLE[t.kind].icon}</span>
          <span className="flex-1 text-gray-800">{t.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="shrink-0 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}
