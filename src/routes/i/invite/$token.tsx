// src/routes/i/invite/$token.tsx — personal invite link: /i/invite/<token>
import { createFileRoute } from '@tanstack/react-router';
import { AiJoin } from '@/components/ui/ai-interviews';

export const Route = createFileRoute('/i/invite/$token')({
  component: function InviteJoin() {
    const { token } = Route.useParams();
    return <AiJoin token={token} />;
  },
});
