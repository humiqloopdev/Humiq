// src/components/ui/ai-interviews/code-editor.tsx
// Code editing/display used by the question editor, the interview rooms and the session report.
//  - CodeEditor: Monaco (the VS Code editor) with a language picker; falls back to a plain box if Monaco can't load.
//  - CodeBlock:  small read-only, syntax-coloured block for previews (no editor needed).
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

export const CODE_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' }, { id: 'typescript', label: 'TypeScript' }, { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' }, { id: 'csharp', label: 'C#' }, { id: 'cpp', label: 'C++' }, { id: 'go', label: 'Go' },
  { id: 'sql', label: 'SQL' }, { id: 'ruby', label: 'Ruby' }, { id: 'php', label: 'PHP' }, { id: 'kotlin', label: 'Kotlin' },
  { id: 'swift', label: 'Swift' }, { id: 'rust', label: 'Rust' }, { id: 'html', label: 'HTML' }, { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' }, { id: 'shell', label: 'Shell' }, { id: 'plaintext', label: 'Plain text' },
];
export const languageLabel = (id: string) => CODE_LANGUAGES.find((l) => l.id === id)?.label ?? id;

/* ── Editor ─────────────────────────────────────────────────── */
interface EditorProps {
  value: string;
  onChange: (code: string) => void;
  language: string;
  /** When given, a language dropdown is shown in the header. */
  onLanguageChange?: (language: string) => void;
  height?: string;
  readOnly?: boolean;
  className?: string;
  /** 'light' + `bare` give the borderless white editor used in the interview code workspace. */
  theme?: 'dark' | 'light';
  bare?: boolean;
}

const MONACO_TIMEOUT_MS = 8000;

export function CodeEditor({ value, onChange, language, onLanguageChange, height = '240px', readOnly, className, theme = 'dark', bare }: EditorProps) {
  const [ready, setReady] = useState(false);
  const [giveUp, setGiveUp] = useState(false);
  // Monaco is fetched from a CDN; if that is blocked or offline, keep the page usable with a plain editor.
  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setGiveUp(true), MONACO_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [ready]);

  const known = CODE_LANGUAGES.some((l) => l.id === language);
  const plain = (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} spellCheck={false} aria-label="Code editor" style={{ height }}
      className={cn('block w-full resize-none p-4 font-mono text-[13px] leading-relaxed outline-none', theme === 'light' ? 'bg-white text-gray-800' : 'bg-[#1e1e1e] text-gray-100')} />
  );

  return (
    <div className={cn('overflow-hidden', bare ? '' : 'rounded-xl border border-gray-800', theme === 'light' ? 'bg-white' : 'bg-[#1e1e1e]', className)}>
      {onLanguageChange && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#18181b] px-3 py-2">
          <select value={language} onChange={(e) => onLanguageChange(e.target.value)} aria-label="Code language"
            className="rounded-md border border-white/15 bg-[#18181b] px-2.5 py-1 text-xs font-medium text-gray-100 outline-none focus:border-green">
            {!known && <option value={language}>{language}</option>}
            {CODE_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
      )}
      {giveUp && !ready ? plain : (
        <Suspense fallback={<div style={{ height }} className="flex items-center justify-center text-xs text-gray-400">Loading editor…</div>}>
          <MonacoEditor
            height={height} language={language} value={value} theme={theme === 'light' ? 'vs' : 'vs-dark'} onMount={() => setReady(true)}
            onChange={(v) => onChange(v ?? '')}
            options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, readOnly, padding: { top: 12, bottom: 12 }, renderLineHighlight: 'line', wordWrap: 'on' }}
          />
        </Suspense>
      )}
    </div>
  );
}

/* ── Read-only block ────────────────────────────────────────── */
const KEYWORDS = new Set((
  'function const let var return if else elif for while do switch case break continue class extends implements interface type enum import from export default new async await ' +
  'try catch finally throw throws def lambda yield pass in not and or is with as public private protected static final void int long float double string boolean bool char ' +
  'null undefined nil true false True False None this self super fn mut impl struct use match package namespace using func go defer ' +
  'select from where join left right inner outer on group by order having limit insert into values update set delete create table alter drop distinct union'
).split(' '));

type Tok = { text: string; cls?: string };

function tokenize(code: string, language: string): Tok[] {
  const line = ['python', 'ruby', 'shell'].includes(language) ? '#[^\\n]*' : language === 'sql' ? '--[^\\n]*' : '\\/\\/[^\\n]*';
  const re = new RegExp(`(${line}|\\/\\*[\\s\\S]*?\\*\\/)|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b[A-Za-z_]\\w*\\b)`, 'g');
  const out: Tok[] = [];
  let last = 0;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    if (m.index > last) out.push({ text: code.slice(last, m.index) });
    const [text, comment, str, num, word] = m;
    if (comment) out.push({ text, cls: 'text-gray-500 italic' });
    else if (str) out.push({ text, cls: 'text-amber-300' });
    else if (num) out.push({ text, cls: 'text-orange-300' });
    else if (word) {
      const next = code.slice(m.index + text.length).match(/^\s*\(/);
      const isKeyword = KEYWORDS.has(language === 'sql' ? word.toLowerCase() : word);
      out.push({ text, cls: isKeyword ? 'text-pink-400' : next ? 'text-sky-300' : undefined });
    }
    last = m.index + text.length;
  }
  if (last < code.length) out.push({ text: code.slice(last) });
  return out;
}

export function CodeBlock({ code, language = 'plaintext', header = true, right, className, label }: { code: string; language?: string; header?: boolean; right?: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl bg-[#0d0d10] text-gray-100', className)}>
      {header && (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#18181b] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <span className="inline-flex items-center gap-1.5"><Code2 size={13} />{label ?? languageLabel(language)}</span>
          {right}
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed"><code>{tokenize(code, language).map((t, i) => (t.cls ? <span key={i} className={t.cls}>{t.text}</span> : t.text))}</code></pre>
    </div>
  );
}
