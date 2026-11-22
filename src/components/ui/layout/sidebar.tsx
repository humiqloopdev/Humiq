// src/components/ui/layout/sidebar.tsx
import { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Home, ClipboardList, Video, Search, Heart, User, FileText, CreditCard,
  Briefcase, Users, BarChart3, Bot, Settings, Building2, ShieldCheck, LayoutDashboard, MessageSquare, PlayCircle, PlusCircle, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SidebarItem = { section: string } | { to: string; icon: ReactNode; label: string };

function SidebarShell({ items, open, onClose }: { items: SidebarItem[]; open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed top-16 left-0 bottom-0 w-72 sm:w-60 bg-white border-r border-gray-100 overflow-y-auto py-4 z-40',
          'transition-transform duration-200 ease-out',
          'lg:translate-x-0 lg:z-30',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {items.map((item, i) => {
          if ('section' in item)
            return (
              <div key={i} className="px-5 pt-4 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {item.section}
              </div>
            );
          const { to, icon, label } = item as { to: string; icon: ReactNode; label: string };
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className="flex items-center gap-3 px-5 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all text-gray-600 hover:bg-gray-50 hover:text-navy"
              activeProps={{
                className: cn('flex items-center gap-3 px-5 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all bg-green-xlt text-green font-semibold'),
              }}
            >
              <span className="w-5 flex-shrink-0">{icon}</span>
              {label}
            </Link>
          );
        })}
      </aside>
    </>
  );
}

const SZ = 17;

export function CandidateSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SidebarShell
      open={open}
      onClose={onClose}
      items={[
        { section: 'Candidate' },
        { to: '/candidate/dashboard', icon: <Home size={SZ} />, label: 'Dashboard' },
        { to: '/candidate/applications', icon: <ClipboardList size={SZ} />, label: 'Applications' },
        { to: '/candidate/interviews', icon: <Video size={SZ} />, label: 'My Interviews' },
        { to: '/candidate/jobs', icon: <Search size={SZ} />, label: 'Find Jobs' },
        { to: '/candidate/open-interviews', icon: <Sparkles size={SZ} />, label: 'Open Interviews' },
        { to: '/candidate/saved', icon: <Heart size={SZ} />, label: 'Saved Jobs' },
        { section: 'Profile' },
        { to: '/candidate/profile', icon: <User size={SZ} />, label: 'My Profile' },
        { to: '/candidate/resume', icon: <FileText size={SZ} />, label: 'Resume' },
        { section: 'Earnings' },
        { to: '/candidate/payments', icon: <CreditCard size={SZ} />, label: 'Payments' },
      ]}
    />
  );
}

export function EmployerSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SidebarShell
      open={open}
      onClose={onClose}
      items={[
        { section: 'AI Interviews' },
        { to: '/employer/ai/dashboard', icon: <LayoutDashboard size={SZ} />, label: 'AI Dashboard' },
        { to: '/employer/ai/interviews/new', icon: <PlusCircle size={SZ} />, label: 'New Interview' },
        { to: '/employer/ai/interviews', icon: <MessageSquare size={SZ} />, label: 'AI Interviews' },
        { to: '/employer/ai/sessions', icon: <PlayCircle size={SZ} />, label: 'Interview Results' },
        { section: 'Operations' },
        { to: '/employer/payroll', icon: <CreditCard size={SZ} />, label: 'Payroll' },
        { to: '/employer/analytics', icon: <BarChart3 size={SZ} />, label: 'Analytics' },
        { to: '/employer/team', icon: <Users size={SZ} />, label: 'Team' },
      ]}
    />
  );
}

export function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SidebarShell
      open={open}
      onClose={onClose}
      items={[
        { section: 'Platform' },
        { to: '/admin/dashboard', icon: <Home size={SZ} />, label: 'Overview' },
        { to: '/admin/users', icon: <User size={SZ} />, label: 'Users' },
        { to: '/admin/employers', icon: <Building2 size={SZ} />, label: 'Employers' },
        { to: '/admin/jobs', icon: <Briefcase size={SZ} />, label: 'Job Listings' },
        { section: 'AI System' },
        { to: '/admin/interview', icon: <Video size={SZ} />, label: 'Interview Config' },
        { to: '/admin/scoring', icon: <BarChart3 size={SZ} />, label: 'Scoring Model' },
        { to: '/admin/llm', icon: <Bot size={SZ} />, label: 'LLM Settings' },
        { section: 'Operations' },
        { to: '/admin/payroll', icon: <CreditCard size={SZ} />, label: 'Payroll & Billing' },
        { to: '/admin/compliance', icon: <ShieldCheck size={SZ} />, label: 'Compliance' },
        { section: 'Settings' },
        { to: '/admin/settings', icon: <Settings size={SZ} />, label: 'Settings' },
      ]}
    />
  );
}
