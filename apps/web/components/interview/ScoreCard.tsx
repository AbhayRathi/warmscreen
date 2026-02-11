'use client';

interface ScoreCardProps {
  score: number | null;
  decision: string | null;
  categoryBreakdown?: Record<string, number>;
  strengths?: string[];
  weaknesses?: string[];
}

/**
 * Visual score card showing overall interview score and category breakdown
 */
export function ScoreCard({
  score,
  decision,
  categoryBreakdown,
  strengths = [],
  weaknesses = [],
}: ScoreCardProps) {
  const getScoreColor = (value: number) => {
    if (value >= 8.5) return 'text-green-600';
    if (value >= 7.0) return 'text-blue-600';
    if (value >= 5.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (value: number) => {
    if (value >= 8.5) return 'bg-green-100';
    if (value >= 7.0) return 'bg-blue-100';
    if (value >= 5.0) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getDecisionColor = (dec: string | null) => {
    if (!dec) return 'bg-gray-100 text-gray-800';
    if (dec === 'STRONG_HIRE') return 'bg-green-100 text-green-800';
    if (dec === 'HIRE') return 'bg-blue-100 text-blue-800';
    if (dec === 'NO_HIRE') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const formatDecision = (dec: string | null) => {
    if (!dec) return 'Pending';
    return dec.replace(/_/g, ' ');
  };

  const formatCategory = (category: string) => {
    return category
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Interview Score</h2>
          <span
            className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getDecisionColor(decision)}`}
          >
            {formatDecision(decision)}
          </span>
        </div>
        <div className="text-right">
          <div
            className={`text-5xl font-bold ${score !== null ? getScoreColor(score) : 'text-gray-400'}`}
          >
            {score !== null ? score.toFixed(1) : '-'}
          </div>
          <div className="text-gray-500 text-sm">out of 10</div>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown && Object.keys(categoryBreakdown).length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Category Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(categoryBreakdown).map(([category, value]) => (
              <div
                key={category}
                className={`p-4 rounded-lg ${getScoreBgColor(value)}`}
              >
                <div className="text-sm text-gray-600 capitalize">
                  {formatCategory(category)}
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(value)}`}>
                  {value.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths and Weaknesses */}
      <div className="grid md:grid-cols-2 gap-6">
        {strengths.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-green-600">
              ✓ Strengths
            </h3>
            <ul className="space-y-2">
              {strengths.map((strength, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  <span className="text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {weaknesses.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-red-600">
              △ Areas for Improvement
            </h3>
            <ul className="space-y-2">
              {weaknesses.map((weakness, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  <span className="text-gray-700">{weakness}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
