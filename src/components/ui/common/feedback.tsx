// src/components/ui/common/feedback.tsx
import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALERT_STYLES: Record<string, { wrapper: string; icon: ReactNode }> = {
  success: { wrapper: 'bg-green-xlt border border-green-lt text-green-dk', icon: <CheckCircle2 size={18} /> },
  warning: { wrapper: 'bg-amber-lt border border-amber/30 text-amber', icon: <AlertTriangle size={18} /> },
  error: { wrapper: 'bg-red-lt border border-red/30 text-red', icon: <X size={18} /> },
  info: { wrapper: 'bg-blue-lt border border-blue/20 text-blue', icon: <Info size={18} /> },
};

export function Alert({ v = 'info', children }: { v?: 'success' | 'warning' | 'error' | 'info'; children?: ReactNode }) {
  const s = ALERT_STYLES[v];
  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-medium', s.wrapper)}>
      <span className="flex-shrink-0 mt-0.5">{s.icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function Divider({ text }: { text?: string }) {
  if (text)
    return (
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium px-1">{text}</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    );
  return <div className="h-px bg-gray-200 my-4" />;
}

export function Spinner({ size = 20 }: { size?: number }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

export function LoadingState({ msg = 'Loading…' }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Spinner size={40} />
      <p className="text-sm text-gray-500">{msg}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title?: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="text-gray-300">{icon ?? <Inbox size={40} />}</div>
      {title && <div className="text-base font-bold text-gray-700">{title}</div>}
      {body && <div className="text-sm text-gray-400 max-w-xs">{body}</div>}
      {action}
    </div>
  );
}
