import { createFileRoute } from '@tanstack/react-router';
import { AiSessionsPage } from '@/components/ui/ai-interviews';

export const Route = createFileRoute('/_authenticated/employer/ai/sessions/')({
  component: AiSessionsPage,
});
