// src/components/ui/candidate/profile-page.tsx
import { useState } from 'react';
import { User, MapPin, Edit3, CheckCircle2, Award, Star } from 'lucide-react';
import { Alert, Badge, Btn, Card, LoadingState, ProgressBar, Tag } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import {
  apiErrorMessage, useInterviewHistory, useInterviewResults, useProfile, useProfileCompleteness, useUpdateProfile,
} from '@/api/candidate/useCandidateQueries';
import { initials } from '@/lib/utils';

const CATEGORY_LABEL: Record<string, string> = {
  technical_depth: 'Technical Depth', communication: 'Communication',
  system_design: 'System Design', problem_solving: 'Problem Solving',
};

const FIELD = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green';

interface Draft { headline: string; primaryRole: string; location: string; availability: string; phone: string; bio: string }

export function ProfilePage() {
  const { data: p, isLoading, isError } = useProfile();
  const { data: completeness } = useProfileCompleteness();
  const { data: interviews = [] } = useInterviewHistory();
  const lastScored = interviews.find((i) => i.status === 'completed' && i.overall_score != null);
  const { data: results } = useInterviewResults(lastScored?.id);
  const update = useUpdateProfile();

  const [draft, setDraft] = useState<Draft | null>(null); // null = not editing
  const [error, setError] = useState('');

  if (isLoading) return <CandidateShell><LoadingState msg="Loading profile…" /></CandidateShell>;
  if (isError || !p) return <CandidateShell><Alert v="error">Could not load your profile. Is the backend running?</Alert></CandidateShell>;

  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email;
  const prefs = p.preferences;
  const rate = prefs?.minRate != null ? `$${prefs.minRate}–${prefs.preferredRate ?? prefs.minRate}/hr` : '—';

  const startEdit = () => setDraft({
    headline: p.headline ?? '', primaryRole: p.primaryRole ?? '', location: p.location ?? '',
    availability: p.availability ?? '', phone: p.phone ?? '', bio: p.bio ?? '',
  });

  const save = async () => {
    if (!draft) return;
    try {
      // Only send fields with a value: the API rejects empty strings for some fields.
      const body = Object.fromEntries(Object.entries(draft).filter(([, v]) => v.trim() !== ''));
      await update.mutateAsync(body);
      setError('');
      setDraft(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  const pct = completeness?.score ?? p.profileScore;

  return (
    <CandidateShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy">My Profile</h1>
          <p className="text-sm text-gray-400 mt-0.5">How employers see you</p>
        </div>
        <div className="flex gap-2 self-start">
          {draft && <Btn v="ghost" sz="sm" onClick={() => { setDraft(null); setError(''); }}>Cancel</Btn>}
          <Btn v={draft ? 'primary' : 'outline'} sz="sm" icon={<Edit3 size={14} />} loading={update.isPending} onClick={draft ? save : startEdit}>
            {draft ? 'Save Changes' : 'Edit Profile'}
          </Btn>
        </div>
      </div>
      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="flex flex-col gap-5">
          <Card className="text-center">
            <div className="w-20 h-20 rounded-full bg-navy text-white font-display font-extrabold text-2xl flex items-center justify-center mx-auto mb-3">
              {initials(fullName)}
            </div>
            <div className="font-display font-bold text-navy text-lg">{fullName}</div>
            {draft ? (
              <div className="flex flex-col gap-2 mt-3 text-left">
                <input className={FIELD} placeholder="Primary role" value={draft.primaryRole} onChange={set('primaryRole')} />
                <input className={FIELD} placeholder="Location" value={draft.location} onChange={set('location')} />
                <input className={FIELD} placeholder="Availability (e.g. Immediately)" value={draft.availability} onChange={set('availability')} />
                <input className={FIELD} placeholder="Phone" value={draft.phone} onChange={set('phone')} />
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-500 mb-1">{p.primaryRole ?? 'Add your primary role'}</div>
                <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-4">
                  <MapPin size={12} /> {p.location ?? 'Location not set'}
                </div>
                {p.availability && <Badge v="green">{p.availability}</Badge>}
              </>
            )}
          </Card>

          <Card flat>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-navy">Profile Strength</h4>
              <span className="text-sm font-bold text-green">{pct}%</span>
            </div>
            <ProgressBar label="" value={pct} max={100} showVal={false} />
            <div className="mt-4 flex flex-col gap-2">
              {(completeness?.checklist ?? []).map((c) => (
                <div key={c.key} className="flex items-center gap-2 text-xs">
                  {c.done
                    ? <CheckCircle2 size={13} className="text-green flex-shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 flex-shrink-0" />}
                  <span className={c.done ? 'text-gray-600' : 'text-gray-400'}>{c.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card flat>
            <h4 className="text-sm font-bold text-navy mb-3">Preferences</h4>
            {[
              ['Desired Rate', rate],
              ['Availability', prefs?.availability ?? '—'],
              ['Work Type', prefs?.commitment ?? '—'],
              ['Timezone', prefs?.timezone ?? '—'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-500">{l}</span>
                <span className="font-semibold text-navy">{v}</span>
              </div>
            ))}
          </Card>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <h3 className="font-display font-bold text-navy mb-3 flex items-center gap-2">
              <User size={16} className="text-blue" /> About
            </h3>
            {draft ? (
              <div className="flex flex-col gap-2">
                <input className={FIELD} placeholder="Headline" value={draft.headline} onChange={set('headline')} />
                <textarea className={`${FIELD} min-h-28`} placeholder="Tell employers about yourself" value={draft.bio} onChange={set('bio')} />
              </div>
            ) : (
              <>
                {p.headline && <p className="text-sm font-semibold text-navy mb-1">{p.headline}</p>}
                <p className="text-sm text-gray-600 leading-relaxed">{p.bio ?? 'No summary yet. Click Edit Profile to add one.'}</p>
              </>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-navy flex items-center gap-2">
                <Star size={16} className="text-amber" /> AI Interview Score
              </h3>
              {lastScored && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-display font-extrabold text-green">{lastScored.overall_score}</span>
                  <span className="text-sm text-gray-400">/100</span>
                </div>
              )}
            </div>
            {lastScored ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(results?.scores ?? []).map((s) => (
                  <ProgressBar key={s.category} label={CATEGORY_LABEL[s.category] ?? s.category} value={s.score} max={100} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No scored interview yet.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-display font-bold text-navy mb-3 flex items-center gap-2">
              <Award size={16} className="text-green" /> Skills
            </h3>
            {p.skills.length ? (
              <div className="flex flex-wrap gap-2">{p.skills.map((s) => <Tag key={s.name}>{s.name}</Tag>)}</div>
            ) : (
              <p className="text-sm text-gray-400">No skills added yet.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-display font-bold text-navy mb-3 flex items-center gap-2">
              <Award size={16} className="text-amber" /> Certifications
            </h3>
            {p.certifications.length ? (
              <div className="flex flex-col gap-2">
                {p.certifications.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-green flex-shrink-0" />
                    <span className="text-gray-700">{c.name}{c.issuer ? ` — ${c.issuer}` : ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No certifications added.</p>
            )}
          </Card>
        </div>
      </div>
    </CandidateShell>
  );
}
