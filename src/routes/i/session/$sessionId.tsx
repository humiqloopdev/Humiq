// src/routes/i/session/$sessionId.tsx — the live interview room
import { createFileRoute } from '@tanstack/react-router';
import { AiRoom } from '@/components/ui/ai-interviews';

export const Route = createFileRoute('/i/session/$sessionId')({
  validateSearch: (s: Record<string, unknown>) => ({ preview: s.preview === '1' || s.preview === 1 || s.preview === true ? true : undefined }),
  component: function Room() {
    const { sessionId } = Route.useParams();
    const { preview } = Route.useSearch();
    return <AiRoom sessionId={sessionId} preview={preview} />;
  },
});
