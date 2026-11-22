import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeWorkspace, defaultStarter, newSnippet, type Snippet } from './code-workspace';

// Monaco cannot run in jsdom; a textarea is enough to drive the editor value.
vi.mock('./code-editor', () => ({
  CODE_LANGUAGES: [{ id: 'javascript', label: 'JavaScript' }, { id: 'python', label: 'Python' }],
  languageLabel: (l: string) => l,
  CodeBlock: ({ code }: { code: string }) => <pre data-testid="starter-block">{code}</pre>,
  CodeEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const starter = { language: 'javascript', code: 'function flatten(obj) {\n  // Implementation goes here\n}\n' };

function Harness({ initial, onSubmit, submitting }: { initial?: string; onSubmit: () => void; submitting?: boolean }) {
  const [snippets, setSnippets] = useState<Snippet[]>([{ ...newSnippet(starter), code: initial ?? starter.code }]);
  const [active, setActive] = useState(0);
  return (
    <CodeWorkspace problem="Flatten an object" starter={starter} snippets={snippets} active={active}
      onChange={(s, a) => { setSnippets(s); setActive(a); }} onSubmit={onSubmit} submitting={submitting} />
  );
}

const submitBtn = () => screen.getByRole('button', { name: /submit code/i });
const editor = () => screen.getByLabelText('editor') as HTMLTextAreaElement;

describe('CodeWorkspace submit rules', () => {
  it('shows the problem and the starter code', () => {
    render(<Harness onSubmit={vi.fn()} />);
    expect(screen.getByText('Flatten an object')).toBeInTheDocument();
    expect(screen.getByTestId('starter-block')).toHaveTextContent('Implementation goes here');
  });

  // Negative: nothing typed at all
  it('disables Submit when the editor is empty', async () => {
    render(<Harness initial="" onSubmit={vi.fn()} />);
    expect(submitBtn()).toBeDisabled();
  });

  it('disables Submit when the editor only has whitespace', () => {
    render(<Harness initial={'   \n\t  \n'} onSubmit={vi.fn()} />);
    expect(submitBtn()).toBeDisabled();
  });

  // Negative: candidate never typed anything - the editor still holds the untouched starter stub
  it('disables Submit while the code is still the untouched starter', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    expect(submitBtn()).toBeDisabled();
  });

  it('treats the starter with different trailing whitespace as untouched', () => {
    render(<Harness initial={starter.code.trimEnd() + '\n\n\n'} onSubmit={vi.fn()} />);
    expect(submitBtn()).toBeDisabled();
  });

  it('does not call onSubmit when the disabled button is clicked', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.click(submitBtn());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('tells the candidate why Submit is disabled', () => {
    render(<Harness onSubmit={vi.fn()} />);
    expect(screen.getByText(/write your solution/i)).toBeInTheDocument();
  });

  // Positive
  it('enables Submit once the candidate changes the code, and submits once', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(editor(), 'x');
    expect(submitBtn()).toBeEnabled();
    expect(screen.queryByText(/write your solution/i)).not.toBeInTheDocument();
    await userEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables Submit again if the candidate deletes everything', async () => {
    render(<Harness initial="const a = 1;" onSubmit={vi.fn()} />);
    expect(submitBtn()).toBeEnabled();
    await userEvent.clear(editor());
    expect(submitBtn()).toBeDisabled();
  });

  it('disables Submit while a submission is in flight (no double submit)', () => {
    render(<Harness initial="const a = 1;" onSubmit={vi.fn()} submitting />);
    expect(submitBtn()).toBeDisabled();
  });

  it('a new snippet starts as the untouched starter and cannot be submitted', async () => {
    render(<Harness initial="const a = 1;" onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /new/i }));
    expect(screen.getByRole('button', { name: 'Snippet 2' })).toBeInTheDocument();
    expect(submitBtn()).toBeDisabled();
  });

  it('defaultStarter falls back for unknown languages', () => {
    expect(defaultStarter('brainfuck').code).toContain('Your code here');
  });
});
