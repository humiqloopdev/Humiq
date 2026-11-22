// src/components/ui/layout/app-nav.tsx
import { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Menu, Settings, UserCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Brand } from './public-nav';

export function AppNav({ role, right, onMenuClick }: { role?: string; right?: ReactNode; onMenuClick?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const logoutAll = useAuthStore((s) => s.logoutAll);
  const navigate = useNavigate();
  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2) || '??';

  return (
    <div className="fixed top-0 left-0 right-0 z-40 h-16 bg-white border-b border-gray-100 flex items-center px-3 sm:px-6 gap-2 sm:gap-4">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 hover:text-navy transition-colors cursor-pointer"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
      )}
      <Brand onClick={() => navigate({ to: '/' })} />
      {role && <span className="hidden sm:inline text-xs font-bold text-gray-400 uppercase tracking-widest">{role}</span>}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        {right && <div className="hidden sm:block">{right}</div>}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="w-9 h-9 rounded-full bg-navy text-white font-bold text-sm flex items-center justify-center hover:bg-navy-dk transition-colors select-none cursor-pointer flex-shrink-0">
              {initials}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
            >
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="font-bold text-navy text-sm">{user?.name || 'User'}</div>
                <div className="text-xs text-gray-400">{user?.email}</div>
              </div>
              <DropdownMenu.Item
                onSelect={() => navigate({ to: '/' })}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer outline-none"
              >
                <UserCircle size={15} />
                My Profile
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => navigate({ to: '/' })}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer outline-none"
              >
                <Settings size={15} />
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-gray-100 mx-4" />
              <DropdownMenu.Item
                onSelect={async () => {
                  await logout(); // revokes the session on the server before leaving
                  navigate({ to: '/login' });
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red hover:bg-red-lt transition-colors cursor-pointer outline-none"
              >
                <LogOut size={15} />
                Log Out
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={async () => {
                  await logoutAll();
                  navigate({ to: '/login' });
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer outline-none"
              >
                <LogOut size={15} />
                Sign out of all devices
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
