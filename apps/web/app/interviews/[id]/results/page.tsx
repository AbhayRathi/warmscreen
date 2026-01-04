"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetcher } from "@/lib/api";

export default function ResultsPage() {
  const params = useParams();
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    fetcher(`/api/interviews/${params.id}`)
      .then((data) => {
        setInterview(data.interview);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch interview:', err);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading results...</div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-4">Interview not found</div>
          <Link href="/interviews" className="text-indigo-600 hover:text-indigo-800">
            ← Back to Interviews
          </Link>
        </div>
      </div>
    );
  }

  const overallScore = interview.score || 0;
  const responses = interview.responses || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-6">
          <Link
            href="/interviews"
            className="text-indigo-600 hover:text-indigo-800 inline-flex items-center"
          >
            ← Back to Interviews
          </Link>
        </div>

        <div className="bg-white p-8 rounded-lg shadow text-center mb-6">
          <h1 className="text-3xl font-bold mb-4">Interview Complete!</h1>
          <div className="text-6xl font-bold text-blue-600 mb-2">
            {(overallScore * 10).toFixed(1)}
          </div>
          <div className="text-xl text-gray-600 mb-4">Overall Score</div>
          <div className="flex justify-center gap-4 text-sm text-gray-500">
            <span>Candidate: {interview.candidateName}</span>
            <span>•</span>
            <span>Position: {interview.position}</span>
          </div>
        </div>

        <div className="space-y-6">
          {responses.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
              No responses recorded for this interview.
            </div>
          ) : (
            responses.map((r: any, i: number) => {
              const responseScore = r.confidence || 0;
              const questionText = r.question?.content || r.question?.text || 'Question';
              
              return (
                <div key={r.id} className="bg-white p-6 rounded-lg shadow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg">
                      Q{i + 1}: {questionText}
                    </h3>
                    <div className="text-2xl font-bold text-green-600">
                      {(responseScore * 10).toFixed(1)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded mb-4">
                    <p className="text-gray-700">{r.transcript}</p>
                  </div>

                  {r.scores && typeof r.scores === 'object' && (
                    <div className="bg-blue-50 p-4 rounded mb-4">
                      <h4 className="font-semibold mb-2 text-sm text-gray-700">Score Breakdown:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(r.scores).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="text-gray-600 capitalize">{key}:</span>{' '}
                            <span className="font-semibold">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.tags && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {r.tags.map((tag: string, idx: number) => (
                        <span
                          key={`${tag}-${idx}`}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.sentiment !== null && r.sentiment !== undefined && (
                    <div className="mt-3 text-sm text-gray-600">
                      Sentiment: {r.sentiment > 0 ? '😊' : r.sentiment < 0 ? '😟' : '😐'}{' '}
                      {(r.sentiment * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`/interviews/${params.id}`}
            className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            View Full Interview Details
          </Link>
        </div>
      </div>
    </div>
  );
}
