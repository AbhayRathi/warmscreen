'use client';

interface ResponseAnalysisProps {
  response: {
    id: string;
    transcript: string;
    duration: number;
    scores: Record<string, number> | null;
    sentiment: number | null;
    confidence: number | null;
    tags: string[];
    question: {
      content: string;
      category: string;
      difficulty: string;
    };
  };
  index: number;
}

/**
 * Component showing individual response analysis with scores and feedback
 */
export function ResponseAnalysis({ response, index }: ResponseAnalysisProps) {
  const scores = response.scores || {};
  const hasScores = Object.keys(scores).length > 0;

  const getSentimentEmoji = (sentiment: number | null) => {
    if (sentiment === null) return '—';
    if (sentiment >= 0.3) return '😊';
    if (sentiment <= -0.3) return '😟';
    return '😐';
  };

  const getSentimentLabel = (sentiment: number | null) => {
    if (sentiment === null) return 'Pending';
    if (sentiment >= 0.3) return 'Positive';
    if (sentiment <= -0.3) return 'Negative';
    return 'Neutral';
  };

  const getConfidenceLabel = (confidence: number | null) => {
    if (confidence === null) return 'Pending';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (confidence === null) return 'bg-gray-100 text-gray-600';
    if (confidence >= 0.8) return 'bg-green-100 text-green-700';
    if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toUpperCase()) {
      case 'EASY':
        return 'bg-green-100 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'HARD':
        return 'bg-red-100 text-red-800';
      case 'EXPERT':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (value: number) => {
    if (value >= 8) return 'bg-green-500';
    if (value >= 6) return 'bg-blue-500';
    if (value >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatCategory = (category: string) => {
    return category
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ')
      .trim();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Calculate average score
  const avgScore = hasScores
    ? Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
    : null;

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-bold text-indigo-600">
              Q{index + 1}
            </span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${getDifficultyColor(response.question.difficulty)}`}
            >
              {response.question.difficulty}
            </span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
              {formatCategory(response.question.category)}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900">
            {response.question.content}
          </h3>
        </div>
        <div className="text-right ml-4">
          <div className="text-sm text-gray-500">
            {formatDuration(response.duration)}
          </div>
          {avgScore !== null && (
            <div className="text-2xl font-bold text-indigo-600">
              {avgScore.toFixed(1)}
            </div>
          )}
        </div>
      </div>

      {/* Answer */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <p className="text-gray-700 whitespace-pre-wrap">{response.transcript}</p>
      </div>

      {/* Scores */}
      {hasScores && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-2">Score Breakdown</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(scores).map(([category, score]) => (
              <div key={category} className="flex items-center gap-1">
                <span className="text-xs text-gray-600 capitalize">
                  {formatCategory(category)}:
                </span>
                <div className="flex items-center">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getScoreColor(score)}`}
                      style={{ width: `${(score / 10) * 100}%` }}
                    />
                  </div>
                  <span className="ml-1 text-xs font-medium">{score.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sentiment and Confidence */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sentiment:</span>
          <span className="text-lg">{getSentimentEmoji(response.sentiment)}</span>
          <span className="text-sm font-medium">{getSentimentLabel(response.sentiment)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Confidence:</span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${getConfidenceColor(response.confidence)}`}
          >
            {getConfidenceLabel(response.confidence)}
            {response.confidence !== null && ` (${(response.confidence * 100).toFixed(0)}%)`}
          </span>
        </div>

        {/* Tags */}
        {response.tags && response.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 ml-auto">
            {response.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
