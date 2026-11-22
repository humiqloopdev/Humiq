// src/components/ui/candidate/onboarding-resume.tsx
import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FileText, Upload } from 'lucide-react';
import { Alert, Btn, Badge, ObLayout, ObCard, StepBar } from '@/components/ui/common';
import { OB_STEPS } from './onboarding-account';
import { apiErrorMessage, useProfile, useUpdateProfile, useUploadResume } from '@/api/candidate/useCandidateQueries';

const MAX_BYTES = 5 * 1024 * 1024;

export function OnboardingResume() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const { data: profile } = useProfile();
  const upload = useUploadResume();
  const update = useUpdateProfile();
  const resume = profile?.resume ?? null;

  const send = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { setError('Resume must be 5 MB or smaller.'); return; }
    upload.mutateAsync(file).then(() => setError('')).catch((e) => setError(apiErrorMessage(e, 'Upload failed')));
  };

  const next = async () => {
    try {
      await update.mutateAsync({ onboardingStep: 3 });
      navigate({ to: '/onboarding/skills' });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <ObLayout>
      <ObCard>
        <StepBar steps={OB_STEPS} active={1} />
        <div className="mt-8">
          <h2 className="font-display text-2xl font-extrabold text-navy mb-2">Upload Your Resume</h2>
          <p className="text-sm text-gray-400 mb-6">Employers see this when you apply</p>
          {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
          <input ref={input} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { send(e.target.files?.[0]); e.target.value = ''; }} />
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files[0]); }}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${drag ? 'border-green bg-green-xlt' : 'border-gray-200 bg-gray-50 hover:border-green hover:bg-green-xlt'}`}
          >
            <Upload size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-bold text-gray-600 mb-1">Drag & drop your resume</p>
            <p className="text-sm text-gray-400 mb-4">PDF or DOCX · Max 5 MB</p>
            <Btn v="outline" sz="sm" type="button" loading={upload.isPending} onClick={() => input.current?.click()}>Browse Files</Btn>
          </div>
          {resume && (
            <div className="mt-4 flex items-center gap-3 bg-green-xlt border border-green-lt rounded-xl px-4 py-3">
              <FileText size={20} className="text-green flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-navy text-sm truncate">{resume.file_name}</div>
                <div className="text-xs text-gray-400">Version {resume.version}</div>
              </div>
              <Badge v="green">✓ Uploaded</Badge>
            </div>
          )}
          <div className="flex gap-3 mt-8">
            <Btn v="outline" sz="lg" type="button" onClick={() => window.history.back()}>← Back</Btn>
            <Btn v="primary" sz="lg" block loading={update.isPending} onClick={next}>
              {resume ? 'Continue →' : 'Skip for now →'}
            </Btn>
          </div>
        </div>
      </ObCard>
    </ObLayout>
  );
}
