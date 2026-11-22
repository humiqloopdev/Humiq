import { createFileRoute } from '@tanstack/react-router';
import { AiInterviewEditor } from '@/components/ui/ai-interviews';

export const Route = createFileRoute('/_authenticated/employer/ai/interviews/$id')({
  component: function Editor() {
    const { id } = Route.useParams();
    return <AiInterviewEditor id={id} />;
  },
});
