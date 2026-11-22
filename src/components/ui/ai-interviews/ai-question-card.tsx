// src/components/ui/ai-interviews/ai-question-card.tsx
// One question in the generator preview: read-only row with drag handle, or an inline editor.
import { useState, type HTMLAttributes } from 'react';
import { Check, CircleDot, Code2, GripVertical, ListChecks, MessageSquare, Microscope, Pencil, PenLine, Plus, Trash2, X } from 'lucide-react';
import { Badge, Btn, Input, Textarea } from '@/components/ui/common';
import { cn } from '@/lib/utils';
import type { QuestionType } from '@/api/aiInterviews/aiInterviewsApi';
import { QUESTION_TYPE_LABEL, Select, Switch } from './ai-bits';
import { CodeBlock, CodeEditor } from './code-editor';

export interface QuestionCardData {
  text: string;
  type: QuestionType;
  description?: string | null;
  isRequired: boolean;
  timeLimitSeconds?: number | null;
  options?: { options: string[]; allowMultiple?: boolean } | null;
  starterCode?: { language: string; code: string } | null;
  followUpPrompts?: string[] | null;
}

const TYPE_ICON: Record<QuestionType, typeof MessageSquare> = {
  OPEN_ENDED: MessageSquare, SINGLE_CHOICE: CircleDot, MULTIPLE_CHOICE: ListChecks, CODING: Code2, WHITEBOARD: PenLine, RESEARCH: Microscope,
};
const isChoice = (t: QuestionType) => t === 'SINGLE_CHOICE' || t === 'MULTIPLE_CHOICE';

interface Props {
  data: QuestionCardData;
  index: number;
  editing: boolean;
  onStartEdit: () => void;
  onSave: (d: QuestionCardData) => void;
  onCancel: () => void;
  onDelete: () => void;
  dragProps?: HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  className?: string;
}

export function AiQuestionCard({ data, index, editing, onStartEdit, onSave, onCancel, onDelete, dragProps, className }: Props) {
  const [d, setD] = useState<QuestionCardData>(data);
  const set = <K extends keyof QuestionCardData>(k: K, v: QuestionCardData[K]) => setD((x) => ({ ...x, [k]: v }));
  const options = d.options?.options ?? [];
  const setOptions = (next: string[]) => set('options', { options: next, allowMultiple: d.type === 'MULTIPLE_CHOICE' });

  if (editing) {
    return (
      <div className="rounded-xl border border-green/40 bg-white p-4 space-y-3">
        <Textarea label="Question text" rows={3} placeholder="Enter the question..." value={d.text} onChange={(e) => set('text', e.target.value)} />
        <Select label="Type" value={d.type} onChange={(e) => {
          const type = e.target.value as QuestionType;
          setD((x) => ({ ...x, type, options: isChoice(type) ? { options: x.options?.options?.length ? x.options.options : ['', ''], allowMultiple: type === 'MULTIPLE_CHOICE' } : null,
            starterCode: type === 'CODING' ? x.starterCode ?? { language: 'javascript', code: '' } : null }));
        }}>
          {Object.entries(QUESTION_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Textarea label="Description (optional)" rows={2} placeholder="Helper text for the interviewee..." value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} />

        {isChoice(d.type) && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-700">Options</div>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input value={o} placeholder={`Option ${String.fromCharCode(65 + i)}`} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
                <Btn v="ghost" sz="sm" aria-label="Remove option" disabled={options.length <= 2} icon={<X size={14} />} onClick={() => setOptions(options.filter((_, j) => j !== i))} />
              </div>
            ))}
            <Btn v="outline" sz="sm" icon={<Plus size={13} />} onClick={() => setOptions([...options, ''])}>Add option</Btn>
          </div>
        )}

        {d.type === 'CODING' && (
          <div className="space-y-1.5">
            <div className="text-sm font-semibold text-gray-700">Starter Code</div>
            <p className="text-xs text-gray-500">Candidates see this template in their code editor. Add a signature and a comment, not the solution.</p>
            <CodeEditor height="220px" value={d.starterCode?.code ?? ''} language={d.starterCode?.language ?? 'javascript'}
              onChange={(code) => set('starterCode', { language: d.starterCode?.language ?? 'javascript', code })}
              onLanguageChange={(language) => set('starterCode', { language, code: d.starterCode?.code ?? '' })} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700">Required</label>
          <Switch checked={d.isRequired} onChange={(v) => set('isRequired', v)} label="Required" />
        </div>
        <div className="flex justify-between pt-1">
          <Btn v="ghost" sz="sm" icon={<Trash2 size={14} />} onClick={() => window.confirm('Delete this question?') && onDelete()}>Delete</Btn>
          <div className="flex gap-2">
            <Btn v="outline" sz="sm" onClick={() => { setD(data); onCancel(); }}>Cancel</Btn>
            <Btn v="primary" sz="sm" icon={<Check size={14} />} disabled={!d.text.trim() || (isChoice(d.type) && options.filter((o) => o.trim()).length < 2)}
              onClick={() => onSave({ ...d, options: isChoice(d.type) ? { options: options.map((o) => o.trim()).filter(Boolean), allowMultiple: d.type === 'MULTIPLE_CHOICE' } : null })}>Done</Btn>
          </div>
        </div>
      </div>
    );
  }

  const Icon = TYPE_ICON[data.type] ?? MessageSquare;
  const { className: dragClass, ...rest } = dragProps ?? {};
  return (
    <div {...rest} className={cn('group flex items-start gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition-all hover:border-green/40', dragClass, className)}>
      <GripVertical size={16} className="mt-1 text-gray-300 cursor-grab flex-shrink-0" aria-hidden />
      <span className="text-xs font-bold text-gray-400 mt-1 w-5 flex-shrink-0">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy">{data.text}</p>
        {data.description && <p className="text-xs text-gray-400 mt-0.5">{data.description}</p>}
        {data.options?.options?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-1.5">{data.options.options.map((o, i) => <span key={i} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{String.fromCharCode(65 + i)}. {o}</span>)}</div>
        ) : null}
        {data.type === 'CODING' && data.starterCode?.code?.trim() && <CodeBlock className="mt-2" code={data.starterCode.code} language={data.starterCode.language} />}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <Badge v="blue"><span className="inline-flex items-center gap-1"><Icon size={11} />{QUESTION_TYPE_LABEL[data.type]}</span></Badge>
          {!data.isRequired && <Badge v="gray">Optional</Badge>}
          {data.timeLimitSeconds ? <Badge v="gray">{data.timeLimitSeconds}s</Badge> : null}
        </div>
      </div>
      <button type="button" onClick={onStartEdit} aria-label="Edit question" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-navy opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"><Pencil size={14} /></button>
    </div>
  );
}
