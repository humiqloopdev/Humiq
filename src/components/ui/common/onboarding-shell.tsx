// src/components/ui/common/onboarding-shell.tsx
import { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Brand } from '@/components/ui/layout/public-nav';

export function ObLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-navy-lt flex flex-col">
      <div className="h-16 bg-white border-b border-gray-100 flex items-center px-4 sm:px-8">
        <Brand onClick={() => navigate({ to: '/' })} />
      </div>
      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">{children}</div>
    </div>
  );
}

export function ObCard({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return <div className={`bg-white rounded-3xl shadow-xl p-5 sm:p-8 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>{children}</div>;
}
