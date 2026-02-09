'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface QuestionFormProps {
  initialData?: {
    id?: string;
    content: string;
    category: string;
    difficulty: string;
    position: string;
    skillTags: string[];
  };
  onSubmit: (data: {
    content: string;
    category: string;
    difficulty: string;
    position: string;
    skillTags: string[];
  }) => Promise<void>;
  isEdit?: boolean;
}

const POSITIONS = [
  'Software Engineer',
  'Product Manager',
  'Data Scientist',
  'Designer',
  'DevOps Engineer',
  'QA Engineer',
  'Engineering Manager',
  'Technical Lead',
];

const CATEGORIES = [
  'TECHNICAL',
  'BEHAVIORAL',
  'SITUATIONAL',
  'CASE_STUDY',
  'CULTURE_FIT',
  'BRAINTEASER',
];

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];

export default function QuestionForm({
  initialData,
  onSubmit,
  isEdit = false,
}: QuestionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');

  const [formData, setFormData] = useState({
    content: initialData?.content || '',
    category: initialData?.category || 'TECHNICAL',
    difficulty: initialData?.difficulty || 'MEDIUM',
    position: initialData?.position || 'Software Engineer',
    skillTags: initialData?.skillTags || [],
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        content: initialData.content || '',
        category: initialData.category || 'TECHNICAL',
        difficulty: initialData.difficulty || 'MEDIUM',
        position: initialData.position || 'Software Engineer',
        skillTags: initialData.skillTags || [],
      });
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.skillTags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        skillTags: [...prev.skillTags, tag],
      }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      skillTags: prev.skillTags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onSubmit(formData);
      router.push('/admin/questions');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Question Content */}
      <div>
        <label
          htmlFor="content"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Question Content *
        </label>
        <textarea
          id="content"
          name="content"
          value={formData.content}
          onChange={handleChange}
          required
          rows={4}
          minLength={10}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Enter the interview question..."
        />
        <p className="mt-1 text-sm text-gray-500">
          Minimum 10 characters. Be specific and clear.
        </p>
      </div>

      {/* Position */}
      <div>
        <label
          htmlFor="position"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Position *
        </label>
        <select
          id="position"
          name="position"
          value={formData.position}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
      </div>

      {/* Category and Difficulty */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Category *
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="difficulty"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Difficulty *
          </label>
          <select
            id="difficulty"
            name="difficulty"
            value={formData.difficulty}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {DIFFICULTIES.map((diff) => (
              <option key={diff} value={diff}>
                {diff}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Skill Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Skill Tags
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a skill tag..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Add
          </button>
        </div>
        {formData.skillTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {formData.skillTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-indigo-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? isEdit
              ? 'Saving...'
              : 'Creating...'
            : isEdit
            ? 'Save Changes'
            : 'Create Question'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/questions')}
          disabled={loading}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
