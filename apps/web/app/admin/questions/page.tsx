'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetcher, apiDelete } from '@/lib/api';
import QuestionList from '@/components/admin/QuestionList';
import QuestionFilters from '@/components/admin/QuestionFilters';

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

interface FilterOptions {
  positions: string[];
  categories: string[];
  difficulties: string[];
}

interface QuestionsResponse {
  success: boolean;
  questions: Question[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filterOptions: FilterOptions;
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    category: '',
    difficulty: '',
    position: '',
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    positions: [],
    categories: [],
    difficulties: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'],
  });

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());
      if (filters.category) params.set('category', filters.category);
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.position) params.set('position', filters.position);

      const data: QuestionsResponse = await fetcher(`/api/questions?${params.toString()}`);

      setQuestions(data.questions);
      setPagination((prev) => ({
        ...prev,
        total: data.total,
        totalPages: data.totalPages,
      }));
      setFilterOptions(data.filterOptions);
      setIsAdmin(true); // If we can fetch, we're at least logged in
    } catch (err: any) {
      if (err.message.includes('Forbidden') || err.message.includes('403')) {
        setError('You do not have admin access to view this page.');
        setIsAdmin(false);
      } else if (err.message.includes('Unauthorized') || err.message.includes('401')) {
        setError('Please sign in to access this page.');
        setIsAdmin(false);
      } else {
        setError(err.message || 'Failed to load questions');
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    // Check admin status by fetching session
    fetcher('/api/session')
      .then((session) => {
        if (session.isLoggedIn) {
          setIsAdmin(true); // Will be verified when we fetch questions
          fetchQuestions();
        } else {
          setError('Please sign in to access this page.');
          setLoading(false);
        }
      })
      .catch(() => {
        setError('Please sign in to access this page.');
        setLoading(false);
      });
  }, [fetchQuestions]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/api/questions/${id}`);
      await fetchQuestions();
    } catch (err: any) {
      setError(err.message || 'Failed to delete question');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading questions...</div>
      </div>
    );
  }

  if (error && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Link href="/auth/signin" className="text-indigo-600 hover:text-indigo-800">
            Sign In →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
            <p className="text-gray-600 mt-1">
              Manage interview questions across all positions
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/admin/questions/new"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              + Add Question
            </Link>
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Questions</p>
            <p className="text-2xl font-bold text-indigo-600">{pagination.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Positions</p>
            <p className="text-2xl font-bold text-blue-600">
              {filterOptions.positions.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Categories</p>
            <p className="text-2xl font-bold text-green-600">
              {filterOptions.categories.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Current Page</p>
            <p className="text-2xl font-bold text-gray-600">
              {pagination.page} / {pagination.totalPages || 1}
            </p>
          </div>
        </div>

        {/* Filters */}
        <QuestionFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          filterOptions={filterOptions}
        />

        {/* Question List */}
        <QuestionList
          questions={questions}
          onDelete={handleDelete}
          isAdmin={isAdmin}
        />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
              let pageNum;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-4 py-2 rounded-lg ${
                    pagination.page === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
