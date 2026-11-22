// src/components/ui/common/progress.tsx
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export function ProgressBar({
  label,
  value,
  max = 100,
  showVal = true,
}: {
  label: string;
  value: number | string;
  max?: number;
  showVal?: boolean;
}) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  const pct = Math.min(100, Math.max(0, (num / max) * 100));
  const display = typeof value === 'string' ? value : `${Math.round(pct)}%`;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        {showVal && <span className="text-xs font-bold text-green">{display}</span>}
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-green rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ScoreRing({ score, sz = 'sm' }: { score: number; sz?: 'sm' | 'md' | 'lg' }) {
  const color =
    score >= 90
      ? 'text-green border-green bg-green-xlt'
      : score >= 80
        ? 'text-blue border-blue bg-blue-lt'
        : score >= 70
          ? 'text-amber border-amber bg-amber-lt'
          : 'text-gray-400 border-gray-200 bg-gray-50';
  const sizeCls = sz === 'lg' ? 'w-20 h-20' : sz === 'md' ? 'w-16 h-16' : 'w-14 h-14';
  return (
    <div className={cn('rounded-full border-[3px] flex flex-col items-center justify-center flex-shrink-0', color, sizeCls)}>
      <span className="text-lg font-bold font-display leading-none">{score}%</span>
      <span className="text-[10px] text-gray-400">match</span>
    </div>
  );
}

export function StepBar({ steps, active }: { steps: string[]; active: number }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {steps.map((s, i) => (
        <div
          key={s}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
            i < active ? 'bg-green text-white' : '',
            i === active ? 'bg-navy text-white' : '',
            i > active ? 'bg-gray-100 text-gray-400' : ''
          )}
        >
          {i < active && <Check size={12} strokeWidth={3} />}
          {i === active && <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />}
          {s}
        </div>
      ))}
    </div>
  );
}
