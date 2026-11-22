// src/components/ui/ai-interviews/code-workspace.tsx
// The one "code screen" used by every interview room: status bar, snippet tabs, problem + starter code, Monaco editor.
import { Check, Code2, FileText, Loader2, Mic, Plus, Volume2 } from 'lucide-react';
import { Btn } from '@/components/ui/common';
import { cn } from '@/lib/utils';
import { CODE_LANGUAGES, CodeBlock, CodeEditor, languageLabel } from './code-editor';

export interface Snippet { id: string; language: string; code: string }
export interface Starter { language: string; code: string }

const STARTERS: Record<string, string> = {
  javascript: 'function solution() {\n  // Your code here\n}\n',
  typescript: 'function solution(): void {\n  // Your code here\n}\n',
  python: 'def solution():\n    # Your code here\n    pass\n',
  java: 'class Solution {\n    // Your code here\n}\n',
  csharp: 'public class Solution\n{\n    // Your code here\n}\n',
  cpp: '#include <iostream>\n\nint main() {\n    // Your code here\n    return 0;\n}\n',
  go: 'package main\n\nfunc solution() {\n\t// Your code here\n}\n',
};
export const defaultStarter = (language: string): Starter => ({ language, code: STARTERS[language] ?? '// Your code here\n' });

let counter = 0;
export const newSnippet = (starter: Starter): Snippet => ({ id: `snip-${Date.now()}-${counter++}`, ...starter });

interface Props {
  problem: string;
  hint?: string;
  starter: Starter;
  snippets: Snippet[];
  active: number;
  onChange: (snippets: Snippet[], active: number) => void;
  /** Voice status shown in the top bar; omit it for text-only rooms. */
  status?: { speaker: string; speaking?: boolean; listening?: boolean; heard?: string };
  /** Candidate-room style autosave indicator. */
  saveState?: 'saved' | 'saving' | 'unsaved';
  /** Rooms that submit code explicitly get a button instead. */
  onSubmit?: () => void;
  submitting?: boolean;
  className?: string;
}

export function CodeWorkspace({ problem, hint, starter, snippets, active, onChange, status, saveState, onSubmit, submitting, className }: Props) {
  const list = snippets.length ? snippets : [newSnippet(starter)];
  const current = list[Math.min(active, list.length - 1)];
  // An untouched starter stub is not an answer: Submit stays disabled until the candidate writes something.
  const norm = (c: string) => c.replace(/\s+/g, ' ').trim();
  const empty = !current.code.trim();
  const untouched = !empty && [starter.code, defaultStarter(current.language).code].some((c) => norm(c) === norm(current.code));
  const update = (patch: Partial<Snippet>) => onChange(list.map((s) => (s.id === current.id ? { ...s, ...patch } : s)), list.indexOf(current));

  return (
    <div className={cn('flex flex-col bg-white min-h-0', className)}>
      {status && (
        <div className="flex items-center gap-5 px-4 h-9 shrink-0 border-b border-gray-200 text-xs">
          <span className={cn('flex items-center gap-1.5', status.speaking ? 'text-green font-medium' : 'text-gray-400')}>
            <Volume2 size={13} />{status.speaker} speaking
          </span>
          <span className={cn('flex items-center gap-1.5', status.listening ? 'text-green font-medium' : 'text-gray-400')}>
            <Mic size={13} />Listening
          </span>
          {status.heard && <span className="ml-auto italic text-gray-500 truncate">“{status.heard}”</span>}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 h-10 shrink-0 border-b border-gray-200">
        {list.map((s, i) => (
          <button key={s.id} type="button" onClick={() => onChange(list, i)}
            className={cn('text-xs font-semibold rounded-md px-3 py-1.5 cursor-pointer', s.id === current.id ? 'bg-green text-white' : 'text-gray-600 hover:bg-gray-100')}>
            Snippet {i + 1}
          </button>
        ))}
        <button type="button" onClick={() => onChange([...list, newSnippet(starter)], list.length)}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-green px-2 py-1.5 cursor-pointer"><Plus size={12} />New</button>
        <span className="ml-auto text-xs text-gray-500">
          {onSubmit ? (
            <span className="flex items-center gap-3">
              {(empty || untouched) && <span className="text-amber">Write your solution before submitting</span>}
              <Btn v="primary" sz="sm" icon={<Code2 size={13} />} loading={submitting} disabled={empty || untouched} onClick={onSubmit}>Submit code</Btn>
            </span>
          ) : saveState === 'saving' ? (
            <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" />Saving…</span>
          ) : saveState === 'unsaved' ? 'Not saved yet' : (
            <span className="flex items-center gap-1"><Check size={13} />Saved</span>
          )}
        </span>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <aside className="md:w-[34%] md:max-w-md shrink-0 overflow-auto p-4 border-b md:border-b-0 md:border-r border-gray-200">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-gray-500 mb-3"><FileText size={13} />PROBLEM</div>
          <p className="text-sm font-medium text-navy leading-relaxed">{problem}</p>
          {hint && <p className="text-xs text-gray-500 mt-4">{hint}</p>}
          <CodeBlock className="mt-4" code={starter.code} language={starter.language} label={`Starter code — ${languageLabel(starter.language)}`} />
        </aside>

        <section className="flex-1 min-w-0 min-h-[260px] flex flex-col">
          <div className="px-3 py-2 shrink-0">
            <select value={current.language} onChange={(e) => update({ language: e.target.value })} aria-label="Code language"
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-navy outline-none focus:border-green">
              {CODE_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-h-0 border-t border-gray-200">
            <CodeEditor bare theme="light" height="100%" className="h-full" value={current.code} language={current.language}
              onChange={(code) => update({ code })} />
          </div>
        </section>
      </div>
    </div>
  );
}
