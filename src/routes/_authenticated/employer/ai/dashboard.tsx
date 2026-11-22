import { createFileRoute } from '@tanstack/react-router';
import { AiDashboard } from '@/components/ui/ai-interviews';

export const Route = createFileRoute('/_authenticated/employer/ai/dashboard')({
  component: AiDashboard,
});
