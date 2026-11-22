import { createFileRoute } from '@tanstack/react-router';
import { AiCreateInterview } from '@/components/ui/ai-interviews';

export const Route = createFileRoute('/_authenticated/employer/ai/interviews/new')({
  component: AiCreateInterview,
});
