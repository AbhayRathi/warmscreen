'use client';

import Link from 'next/link';
import { useState } from 'react';

interface Question {
  id: string;
  content: string;
  category: string;
  difficulty: string;
  position: string;
  skillTags: string[];
  avgScore: number;
  timesAsked: number;
  correlationScore: number;
  createdAt: string;
}

interface QuestionListProps {
  questions: Question[];
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

export default function QuestionList({
  questions,
  onDelete,
  isAdmin,
}: QuestionListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);

  const handleDeleteClick = (question: Question) => {
    setQuestionToDelete(question);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!questionToDelete) return;

    setDeletingId(questionToDelete.id);
    try {
      await onDelete(questionToDelete.id);
    } finally {
      setDeletingId(null);
      setShowDeleteModal(false);
      setQuestionToDelete(null);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY':
        return 'bg-green-100 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'HARD':
        return 'bg-orange-100 text-orange-800';
      case 'EXPERT':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCorrelationColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600';
    if (score >= 0.4) return 'text-yellow-600';
    if (score >= 0) return 'text-gray-600';
    return 'text-red-600';
  };

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500 text-lg">No questions found.</p>
        {isAdmin && (
          <Link
            href="/admin/questions/new"
            className="inline-block mt-4 text-indigo-600 hover:text-indigo-800"
          >
            Create your first question →
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Question
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Difficulty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {questions.map((question) => (
                <tr key={question.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="max-w-md">
                      <p className="text-sm text-gray-900 line-clamp-2">
                        {question.content}
                      </p>
                      {question.skillTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {question.skillTags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {question.skillTags.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{question.skillTags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {question.position}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {question.category}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(
                        question.difficulty
                      )}`}
                    >
                      {question.difficulty}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-gray-900">
                        Asked: <span className="font-medium">{question.timesAsked}</span>
                      </p>
                      <p className="text-gray-600">
                        Avg Score:{' '}
                        <span className="font-medium">
                          {question.avgScore.toFixed(1)}
                        </span>
                      </p>
                      <p className={`${getCorrelationColor(question.correlationScore)}`}>
                        Correlation:{' '}
                        <span className="font-medium">
                          {question.correlationScore.toFixed(2)}
                        </span>
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/questions/${question.id}/analytics`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Analytics
                      </Link>
                      {isAdmin && (
                        <>
                          <Link
                            href={`/admin/questions/${question.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-800 text-sm"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(question)}
                            disabled={deletingId === question.id}
                            className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                          >
                            {deletingId === question.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && questionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Delete Question?
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this question? This action cannot be
              undone.
            </p>
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded mb-6 line-clamp-3">
              &quot;{questionToDelete.content}&quot;
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setQuestionToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId === questionToDelete.id}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deletingId === questionToDelete.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
