'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/api';
import QuestionAnalyticsComponent from '@/components/admin/QuestionAnalytics';

interface Analytics {
  id: string;
  content: string;
  totalResponses: number;
  avgScore: number;
  correlationScore: number;
  timesAsked: number;
  lastUsed: string | null;
  scoreDistribution: { range: string; count: number }[];
  usageOverTime: { date: string; count: number }[];
  difficultyRating: string;
  liveCorrelation?: number | null;
}

interface AnalyticsPageProps {
  params: Promise<{ id: string }>;
}

export default function QuestionAnalyticsPage({ params }: AnalyticsPageProps) {
  const resolvedParams = use(params);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await fetcher(`/api/questions/${resolvedParams.id}/analytics`);
        if (data.success) {
          setAnalytics(data.analytics);
        } else {
          setError('Analytics not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading analytics...</div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">{error || 'Analytics not found'}</div>
          <Link href="/admin/questions" className="text-indigo-600 hover:text-indigo-800">
            ← Back to Questions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <Link
                href="/admin/questions"
                className="text-indigo-600 hover:text-indigo-800 text-sm"
              >
                ← Back to Questions
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 mt-4">
                Question Analytics
              </h1>
              <p className="text-gray-600 mt-1">
                Performance metrics and insights
              </p>
            </div>
            <Link
              href={`/admin/questions/${resolvedParams.id}/edit`}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Edit Question
            </Link>
          </div>

          {/* Analytics Component */}
          <QuestionAnalyticsComponent analytics={analytics} />
        </div>
      </div>
    </div>
  );
}
