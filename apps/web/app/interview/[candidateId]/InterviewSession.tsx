'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetcher, apiPost } from '@/lib/api';
import ProgressBar from '@/components/interview/ProgressBar';
import QuestionCard from '@/components/interview/QuestionCard';
import ResponseInput from '@/components/interview/ResponseInput';
import InterviewComplete from '@/components/interview/InterviewComplete';
import RecorderPanel from '@/components/voice/RecorderPanel';

interface InterviewData {
  id: string;
  candidateId: string;
  candidateName: string;
  position: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface Question {
  id: string;
  content: string;
  category: string;
  difficulty: string;
  position?: string;
}

interface Progress {
  current: number;
  total: number;
  percentage: number;
}

interface InterviewSessionProps {
  candidateId: string;
}

export default function InterviewSession({ candidateId }: InterviewSessionProps) {
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 10, percentage: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResponses, setTotalResponses] = useState(0);
  const [voiceEnabled] = useState(
    () => typeof window !== 'undefined' && process.env.NEXT_PUBLIC_VOICE_ENABLED === 'true',
  );
  const [draftResponseId, setDraftResponseId] = useState<string | null>(null);

  /** Create a draft response so we have a valid responseId for audio upload */
  const createDraftResponse = async (interviewId: string, questionId: string): Promise<string> => {
    const data = await apiPost('/api/responses/draft', { interviewId, questionId });
    return data.id;
  };

  // Load interview session
  const loadSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await fetcher(`/api/interviews/${candidateId}/session`);
      
      setInterview(data.interview);
      setCurrentQuestion(data.currentQuestion);
      setProgress(data.progress);
      setTotalResponses(data.responses?.length || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load interview session');
    } finally {
      setIsLoading(false);
    }
  }, [candidateId]);

  // Start interview
  const startInterview = async () => {
    if (!interview) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await apiPost(`/api/interviews/${interview.id}/start`, {});
      
      setInterview((prev) => prev ? { ...prev, status: 'IN_PROGRESS', startedAt: new Date().toISOString() } : null);
      setCurrentQuestion(data.firstQuestion);
    } catch (err: any) {
      setError(err.message || 'Failed to start interview');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit response
  const submitResponse = async (transcript: string, duration: number) => {
    if (!interview || !currentQuestion) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const data = await apiPost(`/api/interviews/${interview.id}/responses`, {
        questionId: currentQuestion.id,
        transcript,
        duration,
      });
      
      setProgress(data.progress);
      setTotalResponses(data.progress.current);
      
      if (data.isComplete) {
        // Auto-complete the interview
        await completeInterview();
      } else {
        setCurrentQuestion(data.nextQuestion);
        setDraftResponseId(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete interview
  const completeInterview = async () => {
    if (!interview) return;
    
    try {
      await apiPost(`/api/interviews/${interview.id}/complete`, {});
      
      setInterview((prev) => prev ? { ...prev, status: 'COMPLETED', completedAt: new Date().toISOString() } : null);
      setCurrentQuestion(null);
    } catch (error) {
      // Log the error for debugging
      console.error('Error completing interview:', error);
      // If completion fails due to not enough questions, we still mark it complete from the UI
      // This handles edge cases where the user sees completion but the API call fails
      setInterview((prev) => prev ? { ...prev, status: 'COMPLETED', completedAt: new Date().toISOString() } : null);
      setCurrentQuestion(null);
    }
  };

  // Initial load
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Loading state
  if (isLoading && !interview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading interview...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !interview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Interview Not Found</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadSession}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!interview) {
    return null;
  }

  // Completed state
  if (interview.status === 'COMPLETED') {
    return (
      <InterviewComplete
        interview={interview}
        totalResponses={totalResponses}
      />
    );
  }

  // Scheduled state - show start button
  if (interview.status === 'SCHEDULED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome, {interview.candidateName}!
          </h1>
          <p className="text-gray-600 mb-6">
            You&apos;re about to start your interview for the{' '}
            <strong>{interview.position}</strong> position.
          </p>
          
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
            <h2 className="text-sm font-semibold text-blue-800 mb-2">Before you begin:</h2>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• You will answer {progress.total} questions</li>
              <li>• Take your time to provide thoughtful answers</li>
              <li>• Your progress is saved if you refresh the page</li>
            </ul>
          </div>
          
          <button
            onClick={startInterview}
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:bg-gray-400"
          >
            {isLoading ? 'Starting...' : 'Start Interview'}
          </button>
        </div>
      </div>
    );
  }

  // In progress state - show questions
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Progress bar */}
        <div className="mb-6">
          <ProgressBar current={progress.current} total={progress.total} />
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Question and response */}
        {currentQuestion ? (
          <div className="space-y-6">
            <QuestionCard
              question={currentQuestion}
              currentIndex={progress.current}
              total={progress.total}
            />
            <ResponseInput
              onSubmit={submitResponse}
              isLoading={isSubmitting}
              questionId={currentQuestion.id}
            />
            {voiceEnabled && (
              <RecorderPanel
                interviewId={interview.id}
                questionId={currentQuestion.id}
                responseId={draftResponseId ?? undefined}
                onBeforeRecord={async () => {
                  if (!draftResponseId && interview && currentQuestion) {
                    const id = await createDraftResponse(interview.id, currentQuestion.id);
                    setDraftResponseId(id);
                    return id;
                  }
                  return draftResponseId!;
                }}
                onTranscriptionComplete={() => loadSession()}
              />
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading next question...</p>
          </div>
        )}
      </div>
    </div>
  );
}
