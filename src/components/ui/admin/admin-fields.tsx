// src/components/ui/admin/admin-fields.tsx
// Small form controls shared by the admin settings screens.
import { useEffect, useState } from 'react';
import { Alert, Btn } from '@/components/ui/common';
import { apiErrorMessage } from '@/lib/utils';

const BOX = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green';

export function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-gray-50 last:border-0">
      <div className="sm:w-56 flex-shrink-0">
        <div className="text-sm font-semibold text-navy">{label}</div>
        {hint && <div className="text-xs text-gray-400">{hint}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function NumField({ value, onChange, min, max, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return <input type="number" className={BOX} value={Number.isNaN(value) ? '' : value} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />;
}

export function TextField({ value, onChange, maxLength }: { value: string; onChange: (s: string) => void; maxLength?: number }) {
  return <input type="text" className={BOX} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />;
}

export function SelectField({ value, onChange, options }: { value: string; onChange: (s: string) => void; options: [string, string][] }) {
  return (
    <select className={BOX} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (b: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-600">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label ?? (value ? 'On' : 'Off')}
    </label>
  );
}

/**
 * Keeps an editable copy of server data. `form` resets whenever fresh data arrives
 * (after a save), and `dirty` says whether the user has changed anything.
 */
export function useDraft<T>(data: T | undefined) {
  const [form, setForm] = useState<T | undefined>(data);
  useEffect(() => { setForm(data); }, [data]);
  return { form, setForm, dirty: JSON.stringify(form) !== JSON.stringify(data) };
}

export function SaveBar({ onSave, saving, dirty, error, saved }: { onSave: () => void; saving: boolean; dirty: boolean; error?: unknown; saved?: boolean }) {
  return (
    <div className="mt-5">
      {error ? <div className="mb-3"><Alert v="error">{apiErrorMessage(error, 'Could not save')}</Alert></div> : null}
      {saved && !dirty && !error ? <div className="mb-3"><Alert v="success">Saved.</Alert></div> : null}
      <Btn v="primary" loading={saving} disabled={!dirty} onClick={onSave}>Save changes</Btn>
    </div>
  );
}
