// src/components/ui/common/badge.tsx
import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BadgeVariant } from '@/types';

const BADGE_V: Record<BadgeVariant, string> = {
  gray: 'bg-gray-100 text-gray-600',
  green: 'bg-green-xlt text-green-dk',
  blue: 'bg-blue-lt text-blue',
  amber: 'bg-amber-lt text-amber',
  purple: 'bg-purple-lt text-purple',
  red: 'bg-red-lt text-red',
};

export function Badge({ v = 'gray', children }: { v?: BadgeVariant; children?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold', BADGE_V[v])}>
      {children}
    </span>
  );
}

export function Tag({ onRemove, children }: { onRemove?: () => void; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-navy-lt text-navy text-xs font-semibold">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 hover:text-red transition-colors">
          <X size={11} strokeWidth={3} />
        </button>
      )}
    </span>
  );
}

export function Avatar({ initials = '?', sz = 'md', src }: { initials?: string; sz?: 'sm' | 'md' | 'lg'; src?: string }) {
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base' };
  const cls = cn('rounded-full bg-navy text-white font-bold flex items-center justify-center', sizeMap[sz]);
  if (src) return <img src={src} alt={initials} className={cn(cls, 'object-cover')} />;
  return <div className={cls}>{initials}</div>;
}
