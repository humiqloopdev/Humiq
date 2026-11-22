// src/components/ui/ai-interviews/ai-interviews-page.tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Copy, FilePlus2, Link2, Mic, MessageSquare, Plus, Sparkles, Trash2, Users, Video } from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, Input, LoadingState, Modal, SearchBar } from '@/components/ui/common';
import { EmployerShell } from '@/components/ui/layout';
import { timeAgo } from '@/lib/utils';
import {
  apiErrorMessage, useAiInterviews, useAiTemplates, useCreateFromTemplate, useCreateInterview, useDeleteInterviews,
  useDuplicateInterview, usePublishInterview, useUnpublishInterview, type AiInterview,
} from '@/api/aiInterviews/useAiInterviews';
import { copyText, shareUrl } from './ai-bits';

function NewInterviewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: templates = [] } = useAiTemplates();
  const fromTemplate = useCreateFromTemplate();
  const create = useCreateInterview();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const open_ = (id: string) => navigate({ to: '/employer/ai/interviews/$id', params: { id } });
  const useTemplate = (templateId: string) =>
    fromTemplate.mutateAsync(templateId).then((i) => open_(i.id)).catch((e) => setError(apiErrorMessage(e)));
  const blank = () =>
    create.mutateAsync({ title: title.trim() }).then((i) => open_(i.id)).catch((e) => setError(apiErrorMessage(e)));

  return (
    <Modal open={open} onClose={onClose} title="New AI interview">
      {error && <div className="mb-3"><Alert v="error">{error}</Alert></div>}
      <div className="flex gap-2 items-end mb-5">
        <div className="flex-1"><Input label="Start from scratch" placeholder="Interview title, e.g. Senior Backend Engineer" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <Btn v="primary" disabled={title.trim().length < 2} loading={create.isPending} onClick={blank} icon={<FilePlus2 size={15} />}>Create</Btn>
      </div>
      <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Or use a template</div>
      <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
        {templates.map((t) => (
          <button key={t.id} type="button" disabled={fromTemplate.isPending} onClick={() => useTemplate(t.id)}
            className="text-left rounded-xl border border-gray-200 p-3 hover:border-green hover:bg-green-xlt/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-navy text-sm">{t.title}</span>
              <span className="text-xs text-gray-400">{t.questions.length} questions{t.timeLimitMinutes ? ` · ${t.timeLimitMinutes} min` : ''}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function InterviewCard({ i, selected, onSelect }: { i: AiInterview; selected: boolean; onSelect: () => void }) {
  const navigate = useNavigate();
  const publish = usePublishInterview();
  const unpublish = useUnpublishInterview();
  const duplicate = useDuplicateInterview();
  const [msg, setMsg] = useState('');
  const live = i.isActive && !!i.publicSlug;

  const copyLink = async () => {
    const slug = i.publicSlug ?? (await publish.mutateAsync(i.id)).slug;
    setMsg((await copyText(shareUrl(slug))) ? 'Share link copied.' : shareUrl(slug));
  };

  return (
    <Card hover>
      <div className="flex items-start gap-3">
        <input type="checkbox" className="mt-1.5 h-4 w-4 accent-green" checked={selected} onChange={onSelect} aria-label={`Select ${i.title}`} />
        <button type="button" className="flex-1 min-w-0 text-left" onClick={() => navigate({ to: '/employer/ai/interviews/$id', params: { id: i.id } })}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-navy truncate">{i.title}</h3>
            <Badge v={live ? 'green' : 'gray'}>{live ? 'Live' : 'Draft'}</Badge>
          </div>
          {i.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{i.description}</p>}
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-2 flex-wrap">
            <span>{i._count?.questions ?? 0} questions</span>
            <span className="flex items-center gap-1"><Users size={12} />{i._count?.sessions ?? 0} sessions</span>
            <span className="flex items-center gap-1">
              {i.chatEnabled && <MessageSquare size={12} />}{i.voiceEnabled && <Mic size={12} />}{i.videoEnabled && <Video size={12} />}
            </span>
            <span>Updated {timeAgo(i.updatedAt)}</span>
          </div>
        </button>
        <div className="flex gap-1.5 flex-shrink-0">
          <Btn v="outline" sz="sm" icon={<Link2 size={13} />} loading={publish.isPending} onClick={copyLink}>Link</Btn>
          <Btn v="ghost" sz="sm" icon={<Copy size={13} />} loading={duplicate.isPending} onClick={() => duplicate.mutate(i.id)} aria-label="Duplicate" />
        </div>
      </div>
      {(msg || live) && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs">
          <span className="text-gray-500 truncate">{msg || shareUrl(i.publicSlug!)}</span>
          {live && <button type="button" className="text-red-600 font-semibold hover:underline" onClick={() => unpublish.mutate(i.id)}>Unpublish</button>}
        </div>
      )}
    </Card>
  );
}

export function AiInterviewsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAiInterviews();
  const remove = useDeleteInterviews();
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [err, setErr] = useState('');

  const all = data?.interviews ?? [];
  const interviews = all.filter((i) => i.title.toLowerCase().includes(query.toLowerCase()));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <EmployerShell navRight={<Btn v="primary" sz="sm" icon={<Plus size={14} />} onClick={() => navigate({ to: '/employer/ai/interviews/new' })}>New Interview</Btn>}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy">AI Interviews</h1>
          <p className="text-sm text-gray-400 mt-0.5">Design an interview, share a link, and let the AI run the conversation</p>
        </div>
        <Btn v="outline" icon={<FilePlus2 size={14} />} onClick={() => setShowNew(true)}>Use a template</Btn>
        {selected.length > 0 && (
          <Btn v="outline" icon={<Trash2 size={14} />} loading={remove.isPending}
            onClick={() => window.confirm(`Delete ${selected.length} interview(s) and all their sessions?`) &&
              remove.mutateAsync(selected).then(() => setSelected([])).catch((e) => setErr(apiErrorMessage(e)))}>
            Delete {selected.length}
          </Btn>
        )}
      </div>

      {err && <div className="mb-4"><Alert v="error">{err}</Alert></div>}
      <div className="mb-5"><SearchBar value={query} onChange={setQuery} placeholder="Search interviews…" /></div>

      {isLoading && <LoadingState msg="Loading interviews…" />}
      {error && <Alert v="error">{apiErrorMessage(error, 'Could not load interviews. Is the backend running?')}</Alert>}
      {!isLoading && !error && interviews.length === 0 && (
        <EmptyState icon={<Sparkles size={36} />} title={all.length ? 'No matches' : 'No interviews yet'}
          body={all.length ? 'Try a different search.' : 'Create your first AI interview from a template or from scratch.'}
          action={!all.length ? <Btn v="primary" onClick={() => navigate({ to: '/employer/ai/interviews/new' })}>New Interview</Btn> : undefined} />
      )}
      <div className="grid gap-4">
        {interviews.map((i) => <InterviewCard key={i.id} i={i} selected={selected.includes(i.id)} onSelect={() => toggle(i.id)} />)}
      </div>

      <NewInterviewModal open={showNew} onClose={() => setShowNew(false)} />
    </EmployerShell>
  );
}
