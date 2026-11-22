// src/components/ui/admin/admin-settings.tsx
import { useState } from 'react';
import { Alert, Badge, Btn, Card, LoadingState } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { usePlans, usePlatformSettings, useSavePlan, useSavePlatform, type AdminPlan, type PlatformSettings } from '@/api/admin/useAdminQueries';
import { apiErrorMessage } from '@/lib/utils';
import { NumField, Row, SaveBar, TextField, Toggle, useDraft } from './admin-fields';

function PlanEditor({ plan }: { plan: AdminPlan }) {
  const { form, setForm, dirty } = useDraft<AdminPlan>(plan);
  const save = useSavePlan();
  const [error, setError] = useState('');
  if (!form) return null;
  const submit = () =>
    save.mutateAsync({
      code: plan.code,
      data: { name: form.name, priceMonthly: form.priceMonthly, maxRoles: form.maxRoles, features: form.features, isActive: form.isActive },
    }).then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  const nullable = (v: string) => (v.trim() === '' ? null : Number(v));

  return (
    <div className="py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2 mb-3">
        <b className="text-navy">{plan.name}</b>
        {!form.isActive && <Badge v="gray">hidden</Badge>}
      </div>
      {error && <div className="mb-2"><Alert v="error">{error}</Alert></div>}
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-gray-500">Price per month ($) — empty = custom</label>
          <input type="number" min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.priceMonthly ?? ''} onChange={(e) => setForm({ ...form, priceMonthly: nullable(e.target.value) })} /></div>
        <div><label className="text-xs font-semibold text-gray-500">Active roles — empty = unlimited</label>
          <input type="number" min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.maxRoles ?? ''} onChange={(e) => setForm({ ...form, maxRoles: nullable(e.target.value) })} /></div>
      </div>
      <div className="mt-3">
        <label className="text-xs font-semibold text-gray-500">Features (one per line)</label>
        <textarea className="w-full min-h-20 border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.features.join('\n')}
          onChange={(e) => setForm({ ...form, features: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
      </div>
      <div className="flex items-center justify-between mt-2">
        <Toggle value={form.isActive} onChange={(b) => setForm({ ...form, isActive: b })} label="Available to employers" />
        <Btn v="primary" sz="sm" disabled={!dirty} loading={save.isPending} onClick={submit}>Save plan</Btn>
      </div>
    </div>
  );
}

export function AdminSettings() {
  const { data, isLoading, isError } = usePlatformSettings();
  const { data: plans = [] } = usePlans();
  const { form, setForm, dirty } = useDraft<PlatformSettings>(data);
  const save = useSavePlatform();
  const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <AdminShell>
      <div className="mb-6"><h1 className="text-2xl font-display font-bold text-navy">Settings</h1><p className="text-sm text-gray-400 mt-0.5">Platform-wide configuration and subscription plans</p></div>
      {isLoading && <LoadingState />}
      {isError && <Alert v="error">Could not load settings. Is the backend running?</Alert>}
      <div className="grid lg:grid-cols-2 gap-6">
        {form && (
          <Card>
            <h3 className="font-display font-bold text-navy mb-2">Platform Settings</h3>
            <Row label="Platform name"><TextField value={form.platformName} onChange={(v) => set('platformName', v)} maxLength={60} /></Row>
            <Row label="Currency" hint="3-letter code, e.g. USD"><TextField value={form.currency} onChange={(v) => set('currency', v.toUpperCase())} maxLength={3} /></Row>
            <Row label="Commission (%)" hint="Platform fee on contractor payments"><NumField value={form.commissionPercent} min={0} max={50} step={0.5} onChange={(n) => set('commissionPercent', n)} /></Row>
            <Row label="Employer trial (days)"><NumField value={form.trialDays} min={0} max={90} onChange={(n) => set('trialDays', n)} /></Row>
            <Row label="Maintenance mode" hint="Saved; not enforced yet"><Toggle value={form.maintenanceMode} onChange={(b) => set('maintenanceMode', b)} /></Row>
            <Row label="Email notifications" hint="Saved; no email service yet"><Toggle value={form.emailNotifications} onChange={(b) => set('emailNotifications', b)} /></Row>
            <Row label="2FA for admins" hint="Saved; two-factor sign-in is not built yet"><Toggle value={form.adminTwoFactor} onChange={(b) => set('adminTwoFactor', b)} /></Row>
            <SaveBar onSave={() => save.mutate({ ...form })} saving={save.isPending} dirty={dirty} error={save.error} saved={save.isSuccess} />
          </Card>
        )}
        <Card>
          <h3 className="font-display font-bold text-navy mb-2">Subscription Plans</h3>
          {plans.map((p) => <PlanEditor key={p.code} plan={p} />)}
        </Card>
      </div>
    </AdminShell>
  );
}
