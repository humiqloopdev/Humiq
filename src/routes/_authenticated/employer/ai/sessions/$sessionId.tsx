import { createFileRoute } from '@tanstack/react-router';
import { AiSessionReport } from '@/components/ui/ai-interviews';

export const Route = createFileRoute('/_authenticated/employer/ai/sessions/$sessionId')({
  component: function Report() {
    const { sessionId } = Route.useParams();
    return <AiSessionReport sessionId={sessionId} />;
  },
});
