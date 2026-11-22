import { createFileRoute } from '@tanstack/react-router';
import { AiInterviewsPage } from '@/components/ui/ai-interviews';

export const Route = createFileRoute('/_authenticated/employer/ai/interviews/')({
  component: AiInterviewsPage,
});
