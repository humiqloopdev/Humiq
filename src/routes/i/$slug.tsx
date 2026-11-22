// src/routes/i/$slug.tsx — public share link: /i/<slug>
import { createFileRoute } from '@tanstack/react-router';
import { AiJoin } from '@/components/ui/ai-interviews';

export const Route = createFileRoute('/i/$slug')({
  component: function Join() {
    const { slug } = Route.useParams();
    return <AiJoin slug={slug} />;
  },
});
