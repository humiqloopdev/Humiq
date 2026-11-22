// src/components/ui/auth/auth-shell.tsx
import { ReactNode } from 'react';
import { PublicNav } from '@/components/ui/layout';

export function AuthShell({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-navy-lt flex flex-col">
      <PublicNav />
      <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
        <div className={`bg-white rounded-3xl shadow-xl p-5 sm:p-8 w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}>{children}</div>
      </div>
    </div>
  );
}
