// src/components/ui/common/card.tsx
import { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MetricCardProps } from '@/types';

interface CardProps {
  hover?: boolean;
  flat?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Card({ hover, flat, className = '', children, onClick, style }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl p-5',
        flat ? 'border border-gray-200' : 'shadow-card',
        hover && 'hover:shadow-hover cursor-pointer transition-shadow duration-200',
        className
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

const ACCENT_MAP: Record<string, { bg: string; iconBg: string; val: string }> = {
  green: { bg: 'border-green-lt', iconBg: 'bg-green-xlt text-green', val: 'text-green' },
  navy: { bg: 'border-navy-lt', iconBg: 'bg-navy-lt text-navy', val: 'text-navy' },
  blue: { bg: 'border-blue-lt', iconBg: 'bg-blue-lt text-blue', val: 'text-blue' },
  amber: { bg: 'border-amber-lt', iconBg: 'bg-amber-lt text-amber', val: 'text-amber' },
  purple: { bg: 'border-purple-lt', iconBg: 'bg-purple-lt text-purple', val: 'text-purple' },
  red: { bg: 'border-red-lt', iconBg: 'bg-red-lt text-red', val: 'text-red' },
  gray: { bg: 'border-gray-200', iconBg: 'bg-gray-100 text-gray-500', val: 'text-gray-700' },
};

export function MetricCard({ icon, value, label, delta, up = true, accent = 'green' }: MetricCardProps) {
  const a = ACCENT_MAP[accent] || ACCENT_MAP.green;
  return (
    <div className={cn('bg-white rounded-2xl p-5 border-l-4 shadow-card flex items-center gap-4', a.bg)}>
      {icon && (
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', a.iconBg)}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className={cn('text-2xl font-bold font-display', a.val)}>{value}</div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
        {delta && <div className={cn('text-xs font-semibold mt-0.5', up ? 'text-green' : 'text-amber')}>{delta}</div>}
      </div>
    </div>
  );
}
