// src/components/ui/common/search-bar.tsx
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SearchBar({
  placeholder = 'Search…',
  value,
  onChange,
  onSearch,
}: {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onSearch?: () => void;
}) {
  return (
    <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm focus-within:border-green focus-within:ring-2 focus-within:ring-green/20 transition-all">
      <input
        className="flex-1 px-4 py-2.5 text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch?.()}
      />
      <button
        type="button"
        onClick={() => onSearch?.()}
        className="px-5 bg-green text-white text-sm font-semibold hover:bg-green-dk transition-colors"
      >
        Search
      </button>
    </div>
  );
}

export function CheckItem({ done, label, sub }: { done: boolean; label: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
          done ? 'bg-green text-white' : 'border-2 border-gray-200 text-gray-300'
        )}
      >
        {done ? <Check size={13} strokeWidth={3} /> : <Circle size={10} />}
      </div>
      <div>
        <div className={cn('text-sm font-semibold', done ? 'text-navy' : 'text-gray-400')}>{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function Seg({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([label, val]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
            value === val
              ? 'bg-navy text-white border-navy'
              : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-navy hover:text-navy'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
