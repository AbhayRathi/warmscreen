'use client';

import { apiPost } from '@/lib/api';
import Link from 'next/link';
import QuestionForm from '@/components/admin/QuestionForm';

export default function NewQuestionPage() {
  const handleSubmit = async (data: {
    content: string;
    category: string;
    difficulty: string;
    position: string;
    skillTags: string[];
  }) => {
    const response = await apiPost('/api/questions', data);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create question');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin/questions"
              className="text-indigo-600 hover:text-indigo-800 text-sm"
            >
              ← Back to Questions
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-4">
              Create New Question
            </h1>
            <p className="text-gray-600 mt-1">
              Add a new interview question to the question bank
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <QuestionForm onSubmit={handleSubmit} />
          </div>
        </div>
      </div>
    </div>
  );
}
