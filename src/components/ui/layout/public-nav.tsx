// src/components/ui/layout/public-nav.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { Btn } from '@/components/ui/common';

export function Brand({ onClick, className = 'h-10' }: { onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} aria-label="Humiq Loop, AI interview platform" className="cursor-pointer flex-shrink-0">
      <img src="/logo.png" alt="Humiq Loop - AI Interview Platform" className={`${className} w-auto`} />
    </button>
  );
}

/** Section anchors on the landing page; they also work from other pages because they start with "/". */
const NAV_LINKS = [
  { label: 'How it works', href: '/#how' },
  { label: 'For Employers', href: '/#employers' },
  { label: 'For Candidates', href: '/#candidates' },
  { label: 'Pricing', href: '/#pricing' },
];

export function PublicNav() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const go = (opts: Parameters<typeof navigate>[0]) => {
    setOpen(false);
    navigate(opts);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="h-16 flex items-center px-4 sm:px-8 gap-4 sm:gap-8">
        <Brand onClick={() => go({ to: '/' })} />
        <div className="hidden lg:flex items-center gap-6 ml-4 flex-1">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-gray-500 hover:text-navy font-medium transition-colors">{l.label}</a>
          ))}
        </div>
        <div className="hidden lg:flex items-center gap-3 ml-auto">
          <Btn v="outline" sz="sm" onClick={() => go({ to: '/login' })}>
            Log In
          </Btn>
          <Btn v="primary" sz="sm" onClick={() => go({ to: '/signup' })}>
            Get Started →
          </Btn>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="lg:hidden ml-auto w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 hover:text-navy transition-colors cursor-pointer"
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-4 flex flex-col gap-1">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-gray-600 hover:text-navy font-medium py-2.5">{l.label}</a>
          ))}
          <div className="flex gap-3 mt-2 pt-3 border-t border-gray-100">
            <Btn v="outline" sz="sm" block onClick={() => go({ to: '/login' })}>
              Log In
            </Btn>
            <Btn v="primary" sz="sm" block onClick={() => go({ to: '/signup' })}>
              Get Started →
            </Btn>
          </div>
        </div>
      )}
    </nav>
  );
}
