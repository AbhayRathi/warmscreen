'use client';

interface HiringDecisionProps {
  decision: string | null;
  confidence?: number;
  explainability?: {
    summary: string;
    recommendation?: string;
    developmentAreas?: string[];
    scoringBreakdown?: Record<string, number>;
    strengths?: string[];
    weaknesses?: string[];
  } | null;
}

/**
 * Component displaying hiring decision with explanation
 */
export function HiringDecision({
  decision,
  confidence,
  explainability,
}: HiringDecisionProps) {
  const getDecisionConfig = (dec: string | null) => {
    switch (dec) {
      case 'STRONG_HIRE':
        return {
          label: 'Strong Hire',
          icon: '✨',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeColor: 'bg-green-100 text-green-800',
          iconBg: 'bg-green-100',
          description: 'Exceptional candidate who exceeded expectations.',
        };
      case 'HIRE':
        return {
          label: 'Hire',
          icon: '✓',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          badgeColor: 'bg-blue-100 text-blue-800',
          iconBg: 'bg-blue-100',
          description: 'Solid candidate who meets the requirements.',
        };
      case 'NO_HIRE':
        return {
          label: 'No Hire',
          icon: '△',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badgeColor: 'bg-yellow-100 text-yellow-800',
          iconBg: 'bg-yellow-100',
          description: 'Candidate does not meet current requirements.',
        };
      case 'STRONG_NO_HIRE':
        return {
          label: 'Strong No Hire',
          icon: '✕',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeColor: 'bg-red-100 text-red-800',
          iconBg: 'bg-red-100',
          description: 'Clear mismatch with position requirements.',
        };
      default:
        return {
          label: 'Pending',
          icon: '⏳',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          badgeColor: 'bg-gray-100 text-gray-800',
          iconBg: 'bg-gray-100',
          description: 'Interview scoring in progress.',
        };
    }
  };

  const config = getDecisionConfig(decision);

  return (
    <div
      className={`rounded-lg border-2 ${config.borderColor} ${config.bgColor} p-6`}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center text-2xl`}
        >
          {config.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold">Hiring Decision</h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${config.badgeColor}`}
            >
              {config.label}
            </span>
          </div>
          <p className="text-gray-600">{config.description}</p>
        </div>
        {confidence !== undefined && confidence !== null && (
          <div className="text-right">
            <div className="text-sm text-gray-500">Confidence</div>
            <div className="text-2xl font-bold text-gray-800">
              {(confidence * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      {/* Explainability */}
      {explainability && (
        <div className="space-y-4">
          {/* Summary */}
          {explainability.summary && (
            <div className="bg-white/60 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Summary</h3>
              <p className="text-gray-700">{explainability.summary}</p>
            </div>
          )}

          {/* Recommendation */}
          {explainability.recommendation && (
            <div className="bg-white/60 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Recommendation</h3>
              <p className="text-gray-700">{explainability.recommendation}</p>
            </div>
          )}

          {/* Development Areas */}
          {explainability.developmentAreas && explainability.developmentAreas.length > 0 && (
            <div className="bg-white/60 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Development Areas</h3>
              <ul className="list-disc list-inside space-y-1">
                {explainability.developmentAreas.map((area, i) => (
                  <li key={i} className="text-gray-700">
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Scoring Breakdown */}
          {explainability.scoringBreakdown &&
            Object.keys(explainability.scoringBreakdown).length > 0 && (
              <div className="bg-white/60 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Scoring Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(explainability.scoringBreakdown).map(
                    ([category, score]) => (
                      <div
                        key={category}
                        className="bg-white rounded p-3 text-center"
                      >
                        <div className="text-xs text-gray-500 capitalize mb-1">
                          {category.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-xl font-bold text-indigo-600">
                          {typeof score === 'number' ? score.toFixed(1) : score}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {/* Strengths & Weaknesses */}
          <div className="grid md:grid-cols-2 gap-4">
            {explainability.strengths && explainability.strengths.length > 0 && (
              <div className="bg-white/60 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-green-600">Strengths</h3>
                <ul className="space-y-1">
                  {explainability.strengths.map((strength, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span className="text-gray-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {explainability.weaknesses && explainability.weaknesses.length > 0 && (
              <div className="bg-white/60 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-red-600">
                  Areas for Improvement
                </h3>
                <ul className="space-y-1">
                  {explainability.weaknesses.map((weakness, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-red-500 mr-2">△</span>
                      <span className="text-gray-700">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
