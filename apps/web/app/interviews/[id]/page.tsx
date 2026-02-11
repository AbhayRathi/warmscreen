'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetcher, apiPost } from '@/lib/api';
import { ScoreCard } from '@/components/interview/ScoreCard';
import { ResponseAnalysis } from '@/components/interview/ResponseAnalysis';
import { HiringDecision } from '@/components/interview/HiringDecision';

export default function InterviewDetailPage() {
  const params = useParams();
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [scoringError, setScoringError] = useState('');

  const fetchInterview = () => {
    if (params.id) {
      fetcher(`/api/interviews/${params.id}`)
        .then((data) => {
          setInterview(data.interview);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to fetch interview:', err);
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    fetchInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleScoreInterview = async () => {
    if (!params.id) return;
    
    setScoring(true);
    setScoringError('');
    
    try {
      await apiPost(`/api/interviews/${params.id}/score`, {});
      // Refresh interview data to show new scores
      fetchInterview();
    } catch (error: any) {
      console.error('Failed to score interview:', error);
      setScoringError(error.message || 'Failed to score interview');
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading interview...</div>;
  }

  if (!interview) {
    return <div className="p-8">Interview not found</div>;
  }

  const explainability = interview.explainability;
  const canStart = interview.status === 'SCHEDULED';
  const isInProgress = interview.status === 'IN_PROGRESS';
  const hasResponses = interview.responses && interview.responses.length > 0;
  const canScore = hasResponses && !interview.score;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <Link
            href="/interviews"
            className="text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Interviews
          </Link>
          
          <div className="flex gap-4">
            {canScore && (
              <button
                onClick={handleScoreInterview}
                disabled={scoring}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {scoring ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Scoring...
                  </>
                ) : (
                  '🎯 Score Interview'
                )}
              </button>
            )}
            
            {(canStart || isInProgress) && (
              <Link
                href={`/interviews/${params.id}/start`}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                {isInProgress ? 'Continue Interview' : 'Start Interview'}
              </Link>
            )}
          </div>
        </div>

        {/* Scoring Error */}
        {scoringError && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {scoringError}
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">{interview.candidateName}</h1>
              <p className="text-gray-600">{interview.candidateEmail}</p>
              <p className="text-lg font-semibold mt-2">{interview.position}</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    interview.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-800'
                      : interview.status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-800'
                      : interview.status === 'CANCELLED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {interview.status.replace('_', ' ')}
                </span>
                {hasResponses && (
                  <span className="text-sm text-gray-500">
                    {interview.responses.length} response{interview.responses.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-indigo-600 mb-2">
                {interview.score ? interview.score.toFixed(1) : '-'}
              </div>
              {interview.decision && (
                <span
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    interview.decision === 'STRONG_HIRE'
                      ? 'bg-green-100 text-green-800'
                      : interview.decision === 'HIRE'
                      ? 'bg-blue-100 text-blue-800'
                      : interview.decision === 'NO_HIRE'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {interview.decision.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hiring Decision with Explainability */}
        {interview.decision && (
          <div className="mb-6">
            <HiringDecision
              decision={interview.decision}
              confidence={explainability?.confidence}
              explainability={explainability}
            />
          </div>
        )}

        {/* Score Card for completed interviews without full explainability */}
        {interview.score && !explainability && (
          <div className="mb-6">
            <ScoreCard
              score={interview.score}
              decision={interview.decision}
            />
          </div>
        )}

        {/* Responses with Analysis */}
        {hasResponses && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Interview Responses</h2>
            <div className="space-y-6">
              {interview.responses.map((response: any, i: number) => (
                <ResponseAnalysis
                  key={response.id}
                  response={response}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}

        {/* No Responses Yet */}
        {!hasResponses && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500 py-8">
              No responses yet. {canStart ? 'Start the interview to begin collecting responses.' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
