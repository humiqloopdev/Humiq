// src/components/ui/common/button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  v?: 'primary' | 'outline' | 'navy' | 'ghost';
  sz?: 'sm' | 'md' | 'lg' | 'xl' | '';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const BTN_V: Record<string, string> = {
  primary: 'bg-green text-white hover:bg-green-dk shadow-sm hover:shadow-green',
  outline: 'bg-white border border-gray-200 text-gray-600 hover:border-green hover:text-green',
  navy: 'bg-navy text-white hover:bg-navy-dk',
  ghost: 'bg-transparent text-gray-500 hover:bg-gray-100',
};
const BTN_SZ: Record<string, string> = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-sm px-5 py-2.5',
  xl: 'text-base px-7 py-3.5',
  '': 'text-sm px-4 py-2',
};

export function Btn({ v = 'primary', sz = '', block, loading, icon, children, className = '', ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cn(BTN_BASE, BTN_V[v], BTN_SZ[sz], block && 'w-full', className)}
      disabled={loading || p.disabled}
    >
      {loading ? <span className="spinner w-4 h-4" /> : icon}
      {children}
    </button>
  );
}
