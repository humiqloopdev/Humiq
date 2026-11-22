// src/components/ui/candidate/interview-intro.tsx
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Btn, Card } from '@/components/ui/common';
import { InterviewChecklist } from './interview-checklist';
import { cn } from '@/lib/utils';

const STEPS = ['Interview Info', 'Checklist', 'Start'];

const NOTICES: { lead?: string; text: string }[] = [
  { text: 'To ensure that the interview runs properly, please use the latest version of Chrome.' },
  { text: 'After completing your answers, please make sure that you have submitted them to all questions. Otherwise it will affect your results.' },
  { lead: 'Tab switching and focus tracking:', text: 'Leaving the interview page or switching to another window will be automatically detected and recorded. If you leave more than 3 times, your session will be flagged for review.' },
  { lead: 'External paste blocked:', text: 'Pasting content from outside the interview page is not allowed. You can copy and paste freely within the page.' },
  { lead: 'Multiple screen detection:', text: 'The system will detect if you have multiple monitors connected. Please unplug or turn off additional screens before starting.' },
  { text: 'This interview requires a camera to collect your registration photo and capture your behavior. All photos are privacy protected.' },
  { text: 'The interview will screen capture throughout. Screen capture requires authorization.' },
];

interface InterviewIntroProps {
  title?: string;
  userName?: string;
  description?: string;
  questionCount: number;
  minutes: number;
  onNext: () => void;
}

export function InterviewIntro({ title = 'AI Interview Assessment', userName, description, questionCount, minutes, onNext }: InterviewIntroProps) {
  const [agreed, setAgreed] = useState(false);
  const [current, setCurrent] = useState(0); // 0 = info, 1 = checklist; the "Start" step hands over to the interview

  return (
    <div className="max-w-3xl mx-auto">
      <ol className="flex items-center justify-center gap-3 mb-6">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border',
                  i <= current ? 'bg-green text-white border-green' : 'bg-white text-gray-400 border-gray-200'
                )}
              >
                {i < current ? <Check size={14} /> : i + 1}
              </span>
              <span className={cn('text-sm', i <= current ? 'text-navy font-medium' : 'text-gray-400')}>{label}</span>
            </span>
            {i < STEPS.length - 1 && <span className="hidden sm:block w-16 h-px bg-gray-200" />}
          </li>
        ))}
      </ol>

      {current === 1 ? (
        <InterviewChecklist onBack={() => setCurrent(0)} onStart={onNext} />
      ) : (
      <>
      <Card flat className="mb-4">
        {userName && <p className="text-sm font-semibold text-green mb-1">Welcome, {userName}</p>}
        <h1 className="font-display text-xl font-bold text-navy mb-4">{title}</h1>
        <div className="text-sm font-semibold text-navy mb-1">Description</div>
        <p className="text-sm text-gray-600 mb-3">
          {description ?? 'A technical interview designed to evaluate your skills and experience through role-specific questions.'}
        </p>
        <p className="text-sm text-gray-500">{questionCount} questions · {minutes} min</p>
      </Card>

      <Card flat className="mb-6">
        <h2 className="font-display text-base font-bold text-navy mb-3">Integrity Notices</h2>
        <p className="text-xs text-amber bg-amber-lt rounded-lg px-3 py-2 mb-4">
          To ensure fairness, the following integrity measures will be actively enforced throughout this session.
        </p>
        <ol className="space-y-2 text-sm text-gray-600">
          {NOTICES.map((n, i) => (
            <li key={n.text}>{i + 1}. {n.lead && <b className="text-navy">{n.lead} </b>}{n.text}</li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-col items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-green cursor-pointer"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          I agree to the above notice and interview guidelines
        </label>
        <Btn v="primary" sz="lg" className="px-12" disabled={!agreed} onClick={() => setCurrent(1)}>Next</Btn>
      </div>
      </>
      )}
    </div>
  );
}
