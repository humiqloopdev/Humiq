// src/routes/_authenticated/candidate/open-interviews/$interviewId.tsx
import { createFileRoute } from '@tanstack/react-router';
import { OpenInterviewDetailPage } from '@/components/ui/candidate';

export const Route = createFileRoute('/_authenticated/candidate/open-interviews/$interviewId')({
  component: function OpenInterviewDetailRoute() {
    const { interviewId } = Route.useParams();
    return <OpenInterviewDetailPage interviewId={interviewId} />;
  },
});
