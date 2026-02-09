'use client';

interface QuestionAnalyticsProps {
  analytics: {
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
  };
}

export default function QuestionAnalytics({ analytics }: QuestionAnalyticsProps) {
  const getCorrelationLabel = (score: number) => {
    if (score >= 0.7) return { label: 'Excellent', color: 'text-green-600 bg-green-100' };
    if (score >= 0.5) return { label: 'Good', color: 'text-blue-600 bg-blue-100' };
    if (score >= 0.3) return { label: 'Fair', color: 'text-yellow-600 bg-yellow-100' };
    if (score >= 0) return { label: 'Low', color: 'text-gray-600 bg-gray-100' };
    return { label: 'Negative', color: 'text-red-600 bg-red-100' };
  };

  const correlationInfo = getCorrelationLabel(analytics.correlationScore);
  const maxUsageCount = Math.max(...analytics.usageOverTime.map((d) => d.count), 1);
  const maxScoreDistCount = Math.max(...analytics.scoreDistribution.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Question Preview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Question</h3>
        <p className="text-gray-700">{analytics.content}</p>
        <div className="mt-3 flex gap-2">
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
            {analytics.difficultyRating}
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Times Asked</p>
          <p className="text-3xl font-bold text-indigo-600">{analytics.timesAsked}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Responses</p>
          <p className="text-3xl font-bold text-blue-600">{analytics.totalResponses}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Average Score</p>
          <p className="text-3xl font-bold text-green-600">{analytics.avgScore.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Correlation Score</p>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold">{analytics.correlationScore.toFixed(2)}</p>
            <span className={`px-2 py-1 text-xs font-medium rounded ${correlationInfo.color}`}>
              {correlationInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Last Used */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Last Used</h3>
        <p className="text-gray-700">
          {analytics.lastUsed
            ? new Date(analytics.lastUsed).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Never used'}
        </p>
      </div>

      {/* Score Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h3>
        <div className="space-y-3">
          {analytics.scoreDistribution.map((item) => (
            <div key={item.range} className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-600">{item.range}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(item.count / maxScoreDistCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-sm text-gray-600 text-right">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Over Time */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Over Time (Last 30 Days)</h3>
        <div className="flex items-end gap-1 h-32">
          {analytics.usageOverTime.map((item) => (
            <div
              key={item.date}
              className="flex-1 bg-indigo-100 hover:bg-indigo-200 rounded-t transition-all duration-200 group relative"
              style={{ height: `${Math.max((item.count / maxUsageCount) * 100, 4)}%` }}
              title={`${item.date}: ${item.count} uses`}
            >
              <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {item.date}: {item.count}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{analytics.usageOverTime[0]?.date}</span>
          <span>{analytics.usageOverTime[analytics.usageOverTime.length - 1]?.date}</span>
        </div>
      </div>

      {/* Live Correlation */}
      {analytics.liveCorrelation !== undefined && analytics.liveCorrelation !== null && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Live Correlation</h3>
          <p className="text-gray-600 text-sm mb-2">
            Calculated from recent hiring outcomes vs question scores
          </p>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-bold">{analytics.liveCorrelation.toFixed(3)}</p>
            <span className={`px-3 py-1 text-sm font-medium rounded ${getCorrelationLabel(analytics.liveCorrelation).color}`}>
              {getCorrelationLabel(analytics.liveCorrelation).label}
            </span>
          </div>
        </div>
      )}

      {/* Interpretation Guide */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Understanding Correlation</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            <strong>0.7+:</strong> Excellent predictor of hiring success - keep using frequently
          </li>
          <li>
            <strong>0.5-0.7:</strong> Good predictor - reliable question for assessments
          </li>
          <li>
            <strong>0.3-0.5:</strong> Fair predictor - useful but consider pairing with others
          </li>
          <li>
            <strong>0-0.3:</strong> Low correlation - may need refinement or context
          </li>
          <li>
            <strong>Negative:</strong> Inversely related - review question for issues
          </li>
        </ul>
      </div>
    </div>
  );
}
