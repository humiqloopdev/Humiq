// src/components/ui/candidate/resume-page.tsx
import { useRef, useState } from 'react';
import { FileText, Upload, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Alert, Badge, Btn, Card, EmptyState, LoadingState, Tag } from '@/components/ui/common';
import { CandidateShell } from '@/components/ui/layout';
import { apiErrorMessage, useParsedResume, useProfile, useUploadResume } from '@/api/candidate/useCandidateQueries';
import { formatShortDate } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;

export function ResumePage() {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const { data: profile, isLoading, isError } = useProfile();
  const resume = profile?.resume ?? null;
  const { data: parsed } = useParsedResume(!!resume);
  const upload = useUploadResume();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (file.size > MAX_BYTES) { setError('Resume must be 5 MB or smaller.'); return; }
    upload.mutateAsync(file).then(() => setError('')).catch((err) => setError(apiErrorMessage(err, 'Upload failed')));
  };

  const status = resume?.parse_status;

  return (
    <CandidateShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy">My Resume</h1>
          <p className="text-sm text-gray-400 mt-0.5">PDF, DOC or DOCX · up to 5 MB</p>
        </div>
        <input ref={input} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={onFile} />
        <Btn v="primary" sz="sm" icon={<Upload size={14} />} loading={upload.isPending} onClick={() => input.current?.click()}>
          {resume ? 'Upload New Version' : 'Upload Resume'}
        </Btn>
      </div>

      {error && <div className="mb-4"><Alert v="error">{error}</Alert></div>}
      {isLoading && <LoadingState msg="Loading resume…" />}
      {isError && <Alert v="error">Could not load your resume. Is the backend running?</Alert>}

      {!isLoading && !isError && !resume && (
        <EmptyState icon={<FileText size={36} />} title="No resume uploaded" body="Upload your resume so employers can review it." />
      )}

      {resume && (
        <>
          <Card className="mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-16 rounded-xl bg-red-lt flex items-center justify-center flex-shrink-0">
                <FileText size={28} className="text-red" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-navy truncate">{resume.file_name}</div>
                <div className="text-xs text-gray-400 mt-0.5">Version {resume.version} · Uploaded {formatShortDate(resume.uploaded_at)}</div>
                <div className="flex items-center gap-2 mt-2">
                  {status === 'parsed' && <Badge v="green"><CheckCircle2 size={10} /> Parsed</Badge>}
                  {status === 'pending' && <Badge v="amber"><Clock size={10} /> Parsing pending</Badge>}
                  {status === 'failed' && <Badge v="red"><AlertCircle size={10} /> Parsing failed</Badge>}
                </div>
              </div>
            </div>
          </Card>

          <Card flat>
            <h4 className="font-bold text-navy text-sm mb-3">Extracted from your resume</h4>
            {status === 'parsed' && parsed?.parsed_data ? (
              <>
                {parsed.parsed_data.skills && (
                  <div className="flex flex-wrap gap-1.5 mb-3">{parsed.parsed_data.skills.map((s) => <Tag key={s}>{s}</Tag>)}</div>
                )}
                {parsed.parsed_data.years != null && (
                  <p className="text-sm text-gray-600">About {parsed.parsed_data.years} years of experience</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">
                Automatic parsing is not enabled yet, so nothing has been extracted from this file.
              </p>
            )}
          </Card>
        </>
      )}
    </CandidateShell>
  );
}
