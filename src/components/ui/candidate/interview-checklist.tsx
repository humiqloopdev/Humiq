// src/components/ui/candidate/interview-checklist.tsx
// src/components/ui/candidate/interview-checklist.tsx
import { ReactNode, useEffect, useRef, useState } from 'react';
import { AudioLines, Camera, Check, Circle, Mic, Monitor, MonitorUp, User } from 'lucide-react';
import { Alert, Btn, Card } from '@/components/ui/common';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'active' | 'done' | 'skipped';

const stop = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

/** Turns a getUserMedia / getDisplayMedia failure into something the candidate can act on. */
function permissionMessage(e: unknown, device: string, fallback: string): string {
  if (!window.isSecureContext || !navigator.mediaDevices) {
    return `Your ${device} can only be used on a secure (HTTPS) page in a supported browser. Use the latest Chrome, or skip this step.`;
  }
  switch ((e as DOMException)?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `${device[0].toUpperCase()}${device.slice(1)} access is blocked. Click the lock icon in the address bar, set ${device} to "Allow", then try again.`;
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `No ${device} was found on this device. Connect one, or skip this step.`;
    case 'NotReadableError':
    case 'AbortError':
      return `Your ${device} is being used by another app. Close it and try again.`;
    default:
      return fallback;
  }
}

function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <span className={cn('flex items-center gap-2 text-sm shrink-0', status === 'done' ? 'text-green font-medium' : 'text-gray-500')}>
      {status === 'done' ? <Check size={16} className="rounded-full bg-green text-white p-0.5" />
        : <Circle size={16} className={status === 'skipped' ? 'text-amber' : 'text-gray-300'} />}
      {status === 'skipped' ? `${label} (skipped)` : label}
    </span>
  );
}

interface ItemProps {
  status: Status;
  badge: string;
  preview: ReactNode;
  action: ReactNode;
  title: string;
  children: ReactNode;
  skipLabel: string;
  onSkip: () => void;
  error?: string;
}

function ChecklistItem({ status, badge, preview, action, title, children, skipLabel, onSkip, error }: ItemProps) {
  return (
    <Card flat className="flex flex-col sm:flex-row gap-5">
      <div className="w-full sm:w-56 shrink-0">
        <div className="h-36 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden mb-2.5">
          {preview}
        </div>
        {action}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-sm font-semibold text-navy">{title}</h3>
          <StatusBadge status={status} label={badge} />
        </div>
        <div className="text-xs text-gray-500 mt-2 space-y-2">{children}</div>
        {status !== 'done' && status !== 'skipped' && (
          <p className="text-xs text-gray-500 mt-3">
            {skipLabel}{' '}
            <button type="button" className="text-green font-semibold hover:underline cursor-pointer" onClick={onSkip}>Skip</button>
          </p>
        )}
        {error && <div className="mt-3"><Alert v="error">{error}</Alert></div>}
      </div>
    </Card>
  );
}

function Placeholder({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <>
      <span className="text-gray-300 mb-2">{icon}</span>
      <span className="text-[11px] text-gray-400">{text}</span>
    </>
  );
}

export function InterviewChecklist({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const [camera, setCamera] = useState<Status>('idle');
  const [mic, setMic] = useState<Status>('idle');
  const [screen, setScreen] = useState<Status>('idle');
  const [errors, setErrors] = useState<{ camera?: string; mic?: string; screen?: string }>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef(0);

  const stopMic = () => {
    cancelAnimationFrame(raf.current);
    stop(micStream.current);
    micStream.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevel(0);
  };
  const stopCamera = () => { stop(camStream.current); camStream.current = null; };

  useEffect(() => () => { stopCamera(); stopMic(); }, []);

  const setError = (k: 'camera' | 'mic' | 'screen', msg?: string) => setErrors((e) => ({ ...e, [k]: msg }));

  /* Camera: first click opens the preview, second click takes the photo */
  const collectPhoto = async () => {
    if (camera !== 'active') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        camStream.current = stream;
        setError('camera');
        setCamera('active');
        requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = stream; });
      } catch (e) {
        setError('camera', permissionMessage(e, 'camera', 'Could not access your camera. Allow camera access in the browser prompt, or skip this step.'));
      }
      return;
    }
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    setPhoto(canvas.toDataURL('image/jpeg', 0.8));
    stopCamera();
    setCamera('done');
  };

  /* Microphone: play a prompt, then listen for the candidate's voice */
  const testMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.current = stream;
      setError('mic');
      setMic('active');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance('Hello, I am your Senior SEO Analyst interviewer. Please say a few words so I can check your microphone.'));
      }
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let loud = 0;
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(1, avg / 60));
        loud = avg > 25 ? loud + 1 : loud;
        if (loud > 15) { // ~¼s of sustained speech
          window.speechSynthesis?.cancel();
          stopMic();
          setMic('done');
          return;
        }
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      stopMic();
      setMic('idle');
      setError('mic', permissionMessage(e, 'microphone', 'Could not access your microphone. Allow microphone access in the browser prompt, or skip this step.'));
    }
  };

  /* Screen: must be the entire screen */
  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const surface = (stream.getVideoTracks()[0].getSettings() as { displaySurface?: string }).displaySurface;
      stop(stream);
      if (surface && surface !== 'monitor') {
        setError('screen', 'Please select "Entire Screen" in the pop-up window, not a window or tab.');
        return;
      }
      setError('screen');
      setScreen('done');
    } catch (e) {
      const cancelled = (e as DOMException)?.name === 'NotAllowedError';
      setError('screen', cancelled
        ? 'Screen sharing was cancelled or blocked. Click "Share Screen" and choose "Entire Screen", or allow screen sharing for this site.'
        : permissionMessage(e, 'screen', 'Could not start screen sharing. Try again, or skip this step.'));
    }
  };

  const ready = [camera, mic, screen].every((s) => s === 'done' || s === 'skipped');

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <ChecklistItem
        status={camera} badge="Collect photo" title="Your photo will be compared with snapshots taken during the SEO analyst interview, so please keep your face visible."
        skipLabel="No camera?" onSkip={() => { stopCamera(); setCamera('skipped'); setError('camera'); }} error={errors.camera}
        preview={
          camera === 'active' ? <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
            : photo ? <img src={photo} alt="Your captured photo" className="w-full h-full object-cover -scale-x-100" />
            : <Placeholder icon={<User size={36} />} text="Keep your face in the frame" />
        }
        action={camera === 'done' || camera === 'skipped' ? (
          <Btn v="outline" block icon={<Camera size={14} />} onClick={() => { setPhoto(null); setCamera('idle'); }}>Retake</Btn>
        ) : (
          <Btn v="primary" block icon={<Camera size={14} />} onClick={collectPhoto}>{camera === 'active' ? 'Take Photo' : 'Start Collecting'}</Btn>
        )}
      >
        <p>Photo collection requires authorization. Please respond to the browser prompts.</p>
      </ChecklistItem>

      <ChecklistItem
        status={mic} badge="Microphone" title="Test your speaker and microphone to make sure audio is working properly."
        skipLabel="No microphone?" onSkip={() => { stopMic(); setMic('skipped'); setError('mic'); }} error={errors.mic}
        preview={mic === 'active' ? (
          <div className="flex items-end gap-1 h-10">
            {[0.4, 0.7, 1, 0.7, 0.4].map((w, i) => (
              <span key={i} className="w-1.5 rounded-full bg-green transition-all" style={{ height: `${10 + level * w * 90}%` }} />
            ))}
          </div>
        ) : <Placeholder icon={<AudioLines size={36} />} text="Speaker & microphone" />}
        action={mic === 'done' || mic === 'skipped' ? (
          <Btn v="outline" block icon={<Mic size={14} />} onClick={() => setMic('idle')}>Test Again</Btn>
        ) : (
          <Btn v="primary" block icon={<Mic size={14} />} disabled={mic === 'active'} onClick={testMic}>{mic === 'active' ? 'Listening…' : 'Test Microphone'}</Btn>
        )}
      >
        <p>Click "Test Microphone" to hear a message from your Senior SEO Analyst interviewer. Then say a few words to confirm your audio works. You will answer questions on technical SEO, keyword research, content strategy and analytics out loud.</p>
      </ChecklistItem>

      <ChecklistItem
        status={screen} badge="Screen capture" title="Screen capture requires authorization. You may be asked to walk through SEO audits, analytics dashboards or search console data on screen."
        skipLabel="Can't share your screen?" onSkip={() => { setScreen('skipped'); setError('screen'); }} error={errors.screen}
        preview={<Placeholder icon={<Monitor size={36} />} text="Entire screen" />}
        action={screen === 'done' || screen === 'skipped' ? (
          <Btn v="outline" block icon={<MonitorUp size={14} />} onClick={() => setScreen('idle')}>Share Again</Btn>
        ) : (
          <Btn v="primary" block icon={<MonitorUp size={14} />} onClick={shareScreen}>Share Screen</Btn>
        )}
      >
        <p>After clicking "Share Screen", select <strong className="text-gray-700">Entire Screen</strong> in the pop-up window and click "Share".</p>
      </ChecklistItem>

      <div className="flex items-center justify-center gap-3 pt-2">
        <Btn v="outline" sz="lg" onClick={onBack}>Back</Btn>
        <Btn v="primary" sz="lg" className="px-10" disabled={!ready} onClick={onStart}>Start Interview</Btn>
      </div>
    </div>
  );
}
