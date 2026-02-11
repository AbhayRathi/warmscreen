interface QuestionCardProps {
  question: {
    id: string;
    content: string;
    category: string;
    difficulty: string;
  };
  currentIndex: number;
  total: number;
  expectedDuration?: number;
}

export default function QuestionCard({
  question,
  currentIndex,
  total,
  expectedDuration,
}: QuestionCardProps) {
  const difficultyColors: Record<string, string> = {
    EASY: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HARD: 'bg-orange-100 text-orange-800',
    EXPERT: 'bg-red-100 text-red-800',
  };

  const categoryColors: Record<string, string> = {
    TECHNICAL: 'bg-blue-100 text-blue-800',
    BEHAVIORAL: 'bg-purple-100 text-purple-800',
    CULTURE_FIT: 'bg-pink-100 text-pink-800',
    ROLE_SPECIFIC: 'bg-indigo-100 text-indigo-800',
    BRAINTEASER: 'bg-cyan-100 text-cyan-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Question {currentIndex + 1} of {total}
        </h2>
        {expectedDuration && (
          <span className="text-sm text-gray-500">
            Expected: ~{Math.round(expectedDuration / 60)} min
          </span>
        )}
      </div>
      
      <div className="mb-4 flex gap-2 flex-wrap">
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            categoryColors[question.category] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {question.category.replace('_', ' ')}
        </span>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            difficultyColors[question.difficulty] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {question.difficulty}
        </span>
      </div>
      
      <p className="text-gray-700 text-lg leading-relaxed">
        {question.content}
      </p>
    </div>
  );
}
