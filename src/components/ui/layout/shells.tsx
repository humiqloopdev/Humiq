// src/components/ui/layout/shells.tsx
import { ReactNode, useState } from 'react';
import { AppNav } from './app-nav';
import { CandidateSidebar, EmployerSidebar, AdminSidebar } from './sidebar';

export function CandidateShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav role="Candidate" onMenuClick={() => setOpen((o) => !o)} />
      <CandidateSidebar open={open} onClose={() => setOpen(false)} />
      <main className="lg:ml-60 pt-16">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 page-enter">{children}</div>
      </main>
    </div>
  );
}

export function EmployerShell({ children, navRight }: { children: ReactNode; navRight?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav role="Employer" right={navRight} onMenuClick={() => setOpen((o) => !o)} />
      <EmployerSidebar open={open} onClose={() => setOpen(false)} />
      <main className="lg:ml-60 pt-16">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 page-enter">{children}</div>
      </main>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav role="ADMIN" onMenuClick={() => setOpen((o) => !o)} />
      <AdminSidebar open={open} onClose={() => setOpen(false)} />
      <main className="lg:ml-60 pt-16">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 page-enter">{children}</div>
      </main>
    </div>
  );
}
