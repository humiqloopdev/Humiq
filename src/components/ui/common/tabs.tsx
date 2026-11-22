// src/components/ui/common/tabs.tsx
import { ReactNode } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

interface TabsProps {
  tabs: { key: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (k: string) => void;
}

/** Tabs — built on Radix Tabs. Renders only the trigger list; pair with RadixTabs.Content elsewhere if needed. */
export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <RadixTabs.Root value={active} onValueChange={onChange}>
      <RadixTabs.List className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
        {tabs.map((t) => (
          <RadixTabs.Trigger
            key={t.key}
            value={t.key}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all cursor-pointer whitespace-nowrap flex-shrink-0',
              'data-[state=active]:border-green data-[state=active]:text-green',
              'data-[state=inactive]:border-transparent data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700'
            )}
          >
            {t.icon}
            {t.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
    </RadixTabs.Root>
  );
}
