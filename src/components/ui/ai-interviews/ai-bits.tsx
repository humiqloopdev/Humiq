// src/components/ui/ai-interviews/ai-bits.tsx
// Small helpers shared by the AI Interviews screens.
import { KeyboardEvent, SelectHTMLAttributes, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BadgeVariant } from '@/types';
import type { AiSession, QuestionType } from '@/api/aiInterviews/useAiInterviews';

export function Select({ label, className = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-semibold text-gray-700">{label}</label>}
      <select
        className={cn(
          'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition-all',
          'focus:border-green focus:ring-2 focus:ring-green/20',
          className
        )}
        {...p}
      >
        {children}
      </select>
    </div>
  );
}

/** Text colour for a /10 session score: red below 7, green otherwise. */
export const scoreTone = (score: number) => (score < 7 ? 'text-red-600' : 'text-green');

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
      <span>
        <span className="block text-sm font-semibold text-gray-700">{label}</span>
        {hint && <span className="block text-xs text-gray-400 mt-0.5">{hint}</span>}
      </span>
      <input type="checkbox" className="mt-1 h-4 w-4 accent-green" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  OPEN_ENDED: 'Open-ended', SINGLE_CHOICE: 'Single choice', MULTIPLE_CHOICE: 'Multiple choice',
  CODING: 'Coding', WHITEBOARD: 'Whiteboard', RESEARCH: 'Research',
};

export const STATUS_BADGE: Record<string, { label: string; v: BadgeVariant }> = {
  COMPLETED: { label: 'Completed', v: 'green' },
  IN_PROGRESS: { label: 'In progress', v: 'amber' },
  ABANDONED: { label: 'Abandoned', v: 'gray' },
};

export function fmtDuration(seconds: number | null | undefined) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

/** Average of per-question scores, falling back to per-criterion scores (0-10). */
export function overallScore(insights: AiSession['insights']): number | null {
  const avg = (rows?: { score?: number | string | null }[] | null) => {
    const nums = (rows ?? []).map((r) => Number(r?.score)).filter((n) => Number.isFinite(n));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };
  return avg(insights?.questionEvaluations) ?? avg(insights?.criteriaEvaluations);
}

export const shareUrl = (slug: string) => `${window.location.origin}/i/${slug}`;
export const inviteUrl = (token: string) => `${window.location.origin}/i/invite/${token}`;

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Pill switch used for channel and anti-cheating settings. */
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed', checked ? 'bg-green' : 'bg-gray-300')}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export const LANGUAGES = [
  { value: 'en', label: 'English' }, { value: 'zh', label: 'Chinese (中文)' }, { value: 'es', label: 'Spanish' }, { value: 'fr', label: 'French' },
] as const;
export const AI_TONES = [
  { value: 'CASUAL', label: 'Casual' }, { value: 'PROFESSIONAL', label: 'Professional' }, { value: 'FORMAL', label: 'Formal' }, { value: 'FRIENDLY', label: 'Friendly' },
] as const;
export const FOLLOW_UP_DEPTHS = [
  { value: 'LIGHT', label: 'Light', description: 'no follow-up' }, { value: 'MODERATE', label: 'Moderate', description: '1-2 follow-ups' }, { value: 'DEEP', label: 'Deep', description: '3-5 follow-ups' },
] as const;

export const EXPERIENCE_LEVELS = ['Entry level', 'Junior', 'Mid-level', 'Senior', 'Lead / Principal'];

/** Type a skill and press Enter or comma to add it; click a chip's x to remove it. Used for an interview's required skills. */
export function SkillsInput({ label, hint, value, onChange }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(',').map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return;
    const have = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    for (const p of parts) if (!have.has(p.toLowerCase())) { next.push(p); have.add(p.toLowerCase()); }
    onChange(next);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-green focus-within:ring-2 focus-within:ring-green/20">
        {value.map((s) => (
          <span key={s} className="flex items-center gap-1 rounded-full bg-green-xlt text-green-dk border border-green-lt text-xs font-medium pl-2.5 pr-1.5 py-1">
            {s}
            <button type="button" aria-label={`Remove ${s}`} className="cursor-pointer hover:text-red-600" onClick={() => onChange(value.filter((v) => v !== s))}><X size={12} /></button>
          </span>
        ))}
        <input className="flex-1 min-w-[8rem] text-sm outline-none bg-transparent py-0.5" placeholder={value.length ? '' : 'e.g. React, Node.js'} value={draft}
          aria-label={label} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => add(draft)} />
      </div>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}
