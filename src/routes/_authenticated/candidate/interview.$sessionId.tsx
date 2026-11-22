// src/routes/_authenticated/candidate/interview.$sessionId.tsx
import { createFileRoute } from '@tanstack/react-router';
import { InterviewRoomPage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/interview/$sessionId')({
  component: InterviewRoomPage,
});
