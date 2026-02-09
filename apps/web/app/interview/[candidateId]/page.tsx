import InterviewSession from './InterviewSession';

interface PageProps {
  params: Promise<{ candidateId: string }>;
}

export default async function InterviewPage({ params }: PageProps) {
  const { candidateId } = await params;

  return <InterviewSession candidateId={candidateId} />;
}

export const metadata = {
  title: 'Interview Session - WarmScreen',
  description: 'Complete your interview session',
};
