// src/components/ui/admin/admin-scoring-model.tsx
import { Alert, Card, LoadingState } from '@/components/ui/common';
import { AdminShell } from '@/components/ui/layout';
import { useSaveScoring, useScoringModel, type ScoringModel } from '@/api/admin/useAdminQueries';
import { NumField, Row, SaveBar, useDraft } from './admin-fields';

const LABEL: Record<keyof ScoringModel['weights'], string> = {
  technical_depth: 'Technical Depth', communication: 'Communication', system_design: 'System Design', problem_solving: 'Problem Solving',
};

export function AdminScoringModel() {
  const { data, isLoading, isError } = useScoringModel();
  const { form, setForm, dirty } = useDraft<ScoringModel>(data);
  const save = useSaveScoring();

  const total = form ? Object.values(form.weights).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0) : 0;
  const valid = Math.round(total) === 100;

  const setWeight = (k: keyof ScoringModel['weights'], n: number) => setForm((f) => (f ? { ...f, weights: { ...f.weights, [k]: n } } : f));
  const setTier = (i: number, patch: Partial<ScoringModel['tiers'][number]>) =>
    setForm((f) => (f ? { ...f, tiers: f.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) } : f));

  return (
    <AdminShell>
      <div className="mb-6"><h1 className="text-2xl font-display font-bold text-navy">Scoring Model</h1><p className="text-sm text-gray-400 mt-0.5">Weights and tier thresholds for AI evaluation</p></div>
      {isLoading && <LoadingState />}
      {isError && <Alert v="error">Could not load the scoring model. Is the backend running?</Alert>}
      {form && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-display font-bold text-navy mb-1">Scoring Weights</h3>
            <p className={`text-xs mb-3 font-semibold ${valid ? 'text-green' : 'text-red'}`}>Total: {total}% {valid ? '' : '— must be exactly 100%'}</p>
            {(Object.keys(LABEL) as (keyof ScoringModel['weights'])[]).map((k) => (
              <Row key={k} label={LABEL[k]}><NumField value={form.weights[k]} min={0} max={100} onChange={(n) => setWeight(k, n)} /></Row>
            ))}
            <SaveBar onSave={() => save.mutate({ ...form })} saving={save.isPending} dirty={dirty && valid} error={save.error} saved={save.isSuccess} />
            <p className="text-xs text-gray-400 mt-3">Saved weights are used when AI scoring is switched on; no interviews are scored automatically yet.</p>
          </Card>
          <Card>
            <h3 className="font-display font-bold text-navy mb-3">Score Tiers</h3>
            <p className="text-xs text-gray-400 mb-3">A candidate is placed in the highest tier whose minimum score they reach.</p>
            {form.tiers.map((t, i) => (
              <div key={t.tier} className="grid grid-cols-[3rem_5rem_1fr] gap-3 items-center py-2 border-b border-gray-50 last:border-0">
                <b className="text-navy text-lg">{t.tier}</b>
                <NumField value={t.min} min={0} max={100} onChange={(n) => setTier(i, { min: n })} />
                <div><div className="text-sm font-semibold text-navy">{t.label}</div><div className="text-xs text-gray-400">{t.visibility}</div></div>
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-3">Edit the minimum score, then use Save changes on the left.</p>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
