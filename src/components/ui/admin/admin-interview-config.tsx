// src/components/ui/admin/admin-interview-config.tsx
import { useState } from 'react';
import { Circle } from 'lucide-react';
import { Alert, Btn, Card, LoadingState } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { useFlags, useInterviewConfig, useResolveFlag, useSaveInterviewConfig, type InterviewConfig } from '@/api/admin/useAdminQueries';
import { apiErrorMessage, timeAgo } from '@/lib/utils';
import { NumField, Row, SaveBar, SelectField, Toggle, useDraft } from './admin-fields';

const DOT = { high: 'text-red', medium: 'text-amber', low: 'text-blue' } as const;
const REASON: Record<string, string> = { ai_assisted: 'Suspected AI-assisted answer', technical_failure: 'Repeated technical failure', other: 'Other' };

export function AdminInterviewConfig() {
  const { data, isLoading, isError } = useInterviewConfig();
  const { form, setForm, dirty } = useDraft<InterviewConfig>(data);
  const save = useSaveInterviewConfig();
  const { data: flags = [] } = useFlags('open');
  const resolve = useResolveFlag();
  const [error, setError] = useState('');

  const set = <K extends keyof InterviewConfig>(k: K, v: InterviewConfig[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const handle = (id: string, resolution: 'resolved' | 'dismissed') => {
    const note = window.prompt(resolution === 'resolved' ? 'What action was taken? (optional)' : 'Why is this being dismissed? (optional)');
    if (note === null) return;
    resolve.mutateAsync({ id, resolution, note: note || undefined }).then(() => setError('')).catch((e) => setError(apiErrorMessage(e)));
  };

  return (
    <AdminShell>
      <div className="mb-6"><h1 className="text-2xl font-display font-bold text-navy">Interview Config</h1><p className="text-sm text-gray-400 mt-0.5">Rules for AI interviews, and the queue of flagged ones</p></div>
      {isLoading && <LoadingState />}
      {isError && <Alert v="error">Could not load the interview settings. Is the backend running?</Alert>}
      <div className="grid lg:grid-cols-2 gap-6">
        {form && (
          <Card>
            <h3 className="font-display font-bold text-navy mb-2">Configuration</h3>
            <Row label="Questions per interview" hint="3–10. Applied to new interviews now."><NumField value={form.questionsPerRole} min={3} max={10} onChange={(n) => set('questionsPerRole', n)} /></Row>
            <Row label="Max duration (minutes)" hint="Saved; not enforced yet"><NumField value={form.maxDurationMinutes} min={10} max={45} onChange={(n) => set('maxDurationMinutes', n)} /></Row>
            <Row label="Max time per answer (minutes)" hint="Saved; not enforced yet"><NumField value={form.maxAnswerMinutes} min={1} max={10} onChange={(n) => set('maxAnswerMinutes', n)} /></Row>
            <Row label="Recording retention (days)"><NumField value={form.recordingRetentionDays} min={7} max={365} onChange={(n) => set('recordingRetentionDays', n)} /></Row>
            <Row label="Retake policy" hint="Saved; not enforced yet">
              <SelectField value={form.retakePolicy} onChange={(v) => set('retakePolicy', v as InterviewConfig['retakePolicy'])}
                options={[['unlimited', 'Unlimited retakes'], ['one_attempt', 'One attempt'], ['technical_failures_only', 'Retake only after technical failures']]} />
            </Row>
            <Row label="AI tool detection" hint="Saved; detection is not built yet"><Toggle value={form.aiToolDetection} onChange={(b) => set('aiToolDetection', b)} /></Row>
            <Row label="Practice mode"><Toggle value={form.practiceMode} onChange={(b) => set('practiceMode', b)} /></Row>
            <SaveBar onSave={() => save.mutate({ ...form })} saving={save.isPending} dirty={dirty} error={save.error} saved={save.isSuccess} />
          </Card>
        )}
        <Card>
          <h3 className="font-display font-bold text-navy mb-5">Flagged Items Queue</h3>
          {error && <div className="mb-3"><Alert v="error">{error}</Alert></div>}
          {flags.length === 0 && <p className="text-sm text-gray-400">Nothing waiting for review.</p>}
          {flags.map((f) => (
            <div key={f.id} className="py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-start gap-3">
                <Circle size={10} className={`${DOT[f.severity as keyof typeof DOT] ?? 'text-gray-400'} mt-1.5`} fill="currentColor" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy text-sm">{REASON[f.reason] ?? f.reason}</div>
                  <div className="text-xs text-gray-400">{f.candidate}{f.job_title ? ` · ${f.job_title}` : ''} · {timeAgo(f.created_at)}</div>
                  {f.details && <div className="text-xs text-gray-600 mt-1">{f.details}</div>}
                </div>
              </div>
              <div className="flex gap-2 mt-2 ml-5">
                <Btn v="primary" sz="sm" disabled={resolve.isPending} onClick={() => handle(f.id, 'resolved')}>Resolve</Btn>
                <Btn v="ghost" sz="sm" disabled={resolve.isPending} onClick={() => handle(f.id, 'dismissed')}>Dismiss</Btn>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </AdminShell>
  );
}
