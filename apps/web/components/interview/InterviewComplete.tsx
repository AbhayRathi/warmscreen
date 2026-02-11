interface InterviewCompleteProps {
  interview: {
    id: string;
    candidateName: string;
    position: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  totalResponses: number;
}

export default function InterviewComplete({
  interview,
  totalResponses,
}: InterviewCompleteProps) {
  const startTime = interview.startedAt ? new Date(interview.startedAt) : null;
  const endTime = interview.completedAt ? new Date(interview.completedAt) : new Date();
  
  const durationMinutes = startTime
    ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Interview Complete!
          </h1>
          <p className="text-gray-600">
            Thank you for completing your interview, {interview.candidateName}.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Summary</h2>
          <div className="space-y-3 text-left">
            <div className="flex justify-between">
              <span className="text-gray-600">Position</span>
              <span className="font-medium text-gray-900">{interview.position}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Questions Answered</span>
              <span className="font-medium text-gray-900">{totalResponses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Time</span>
              <span className="font-medium text-gray-900">{durationMinutes} minutes</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 text-left">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">What&apos;s Next?</h3>
          <p className="text-sm text-blue-700">
            Your responses are being reviewed by our team. We&apos;ll be in touch soon
            with next steps. Thank you for your patience!
          </p>
        </div>
      </div>
    </div>
  );
}
