// src/components/ui/admin/admin-llm-settings.tsx
import { Alert, Badge, Card, LoadingState, ProgressBar } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { useLlmSettings, useSaveLlm, useTokenUsage, type LlmSettings } from '@/api/admin/useAdminQueries';
import { NumField, Row, SaveBar, TextField, useDraft } from './admin-fields';

export function AdminLlmSettings() {
  const { data, isLoading, isError } = useLlmSettings();
  const { data: usage } = useTokenUsage();
  const { form, setForm, dirty } = useDraft<LlmSettings>(data);
  const save = useSaveLlm();
  const set = <K extends keyof LlmSettings>(k: K, v: LlmSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <AdminShell>
      <div className="mb-6"><h1 className="text-2xl font-display font-bold text-navy">LLM Settings</h1><p className="text-sm text-gray-400 mt-0.5">Language model and prompt used for AI interviews</p></div>
      {isLoading && <LoadingState />}
      {isError && <Alert v="error">Could not load the LLM settings. Is the backend running?</Alert>}
      <div className="grid lg:grid-cols-2 gap-6">
        {form && (
          <Card>
            <h3 className="font-display font-bold text-navy mb-2">Model Configuration</h3>
            <Row label="Active model"><TextField value={form.model} onChange={(v) => set('model', v)} maxLength={80} /></Row>
            <Row label="Fallback model"><TextField value={form.fallbackModel} onChange={(v) => set('fallbackModel', v)} maxLength={80} /></Row>
            <Row label="Temperature" hint="0.0 – 1.0"><NumField value={form.temperature} min={0} max={1} step={0.1} onChange={(n) => set('temperature', n)} /></Row>
            <Row label="Max tokens per response"><NumField value={form.maxTokens} min={100} max={8000} onChange={(n) => set('maxTokens', n)} /></Row>
            <Row label="Context window (tokens)"><NumField value={form.contextWindow} min={1000} onChange={(n) => set('contextWindow', n)} /></Row>
            <Row label="Monthly token budget"><NumField value={form.monthlyTokenBudget} min={0} onChange={(n) => set('monthlyTokenBudget', n)} /></Row>
            <div className="pt-3">
              <label className="text-sm font-semibold text-navy block mb-1">System prompt</label>
              <textarea className="w-full min-h-36 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green" maxLength={4000}
                value={form.systemPrompt} onChange={(e) => set('systemPrompt', e.target.value)} />
            </div>
            <SaveBar onSave={() => save.mutate({ ...form })} saving={save.isPending} dirty={dirty} error={save.error} saved={save.isSuccess} />
            <p className="text-xs text-gray-400 mt-3">These are saved for when AI scoring is switched on. Nothing calls the model yet.</p>
          </Card>
        )}
        <Card>
          <h3 className="font-display font-bold text-navy mb-4">Usage this month</h3>
          {usage && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-500">API key</span>
                <Badge v={usage.apiKeyConfigured ? 'green' : 'amber'}>{usage.apiKeyConfigured ? 'Configured on the server' : 'Not configured'}</Badge>
              </div>
              <ProgressBar label={`${usage.usedThisMonth.toLocaleString()} of ${usage.budget.toLocaleString()} tokens`} value={Math.min(usage.percentUsed, 100)} max={100} showVal />
              <p className="text-xs text-gray-400 mt-2 mb-5">{usage.calls} calls so far</p>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">By purpose</h4>
              {usage.byPurpose.length === 0 && <p className="text-sm text-gray-400">No usage recorded yet.</p>}
              {usage.byPurpose.map((p) => (
                <div key={p.purpose} className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">{p.purpose.replaceAll('_', ' ')}</span><b className="text-navy">{p.tokens.toLocaleString()}</b></div>
              ))}
              <p className="text-xs text-gray-400 mt-4">The API key is set in the server's environment (GEMINI_API_KEY), so it cannot be rotated from here.</p>
            </>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
