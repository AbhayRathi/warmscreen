'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { fetcher, apiPatch } from '@/lib/api';
import QuestionForm from '@/components/admin/QuestionForm';

interface Question {
  id: string;
  content: string;
  category: string;
  difficulty: string;
  position: string;
  skillTags: string[];
}

interface EditQuestionPageProps {
  params: Promise<{ id: string }>;
}

export default function EditQuestionPage({ params }: EditQuestionPageProps) {
  const resolvedParams = use(params);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        const data = await fetcher(`/api/questions/${resolvedParams.id}`);
        if (data.success) {
          setQuestion(data.question);
        } else {
          setError('Question not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load question');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestion();
  }, [resolvedParams.id]);

  const handleSubmit = async (data: {
    content: string;
    category: string;
    difficulty: string;
    position: string;
    skillTags: string[];
  }) => {
    const response = await apiPatch(`/api/questions/${resolvedParams.id}`, data);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to update question');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading question...</div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">{error || 'Question not found'}</div>
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
              Edit Question
            </h1>
            <p className="text-gray-600 mt-1">
              Update the question details
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <QuestionForm
              initialData={question}
              onSubmit={handleSubmit}
              isEdit
            />
          </div>
        </div>
      </div>
    </div>
  );
}
