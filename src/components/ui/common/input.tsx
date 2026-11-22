// src/components/ui/common/input.tsx
import { InputHTMLAttributes, TextareaHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', id, ...p }: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-semibold text-gray-700">{label}</label>}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-xl border px-4 py-2.5 text-sm text-gray-800 outline-none transition-all',
          'border-gray-200 bg-white placeholder-gray-400',
          'focus:border-green focus:ring-2 focus:ring-green/20',
          error && 'border-red-400 focus:ring-red-100',
          className
        )}
        {...p}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, rows = 4, className = '', id, ...p }: TextareaProps) {
  const auto = useId();
  const areaId = id ?? auto;
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={areaId} className="text-sm font-semibold text-gray-700">{label}</label>}
      <textarea
        id={areaId}
        rows={rows}
        className={cn(
          'w-full rounded-xl border px-4 py-2.5 text-sm text-gray-800 outline-none transition-all resize-none',
          'border-gray-200 bg-white placeholder-gray-400',
          'focus:border-green focus:ring-2 focus:ring-green/20',
          error && 'border-red-400 focus:ring-red-100',
          className
        )}
        {...p}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
