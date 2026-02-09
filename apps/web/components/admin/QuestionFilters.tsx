'use client';

import { useState, useEffect } from 'react';

interface QuestionFiltersProps {
  filters: {
    category: string;
    difficulty: string;
    position: string;
  };
  onFilterChange: (filters: { category: string; difficulty: string; position: string }) => void;
  filterOptions: {
    positions: string[];
    categories: string[];
    difficulties: string[];
  };
}

export default function QuestionFilters({
  filters,
  onFilterChange,
  filterOptions,
}: QuestionFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleChange = (key: string, value: string) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClear = () => {
    const clearedFilters = { category: '', difficulty: '', position: '' };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Position Filter */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Position
          </label>
          <select
            value={localFilters.position}
            onChange={(e) => handleChange('position', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Positions</option>
            {filterOptions.positions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={localFilters.category}
            onChange={(e) => handleChange('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            {filterOptions.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty Filter */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Difficulty
          </label>
          <select
            value={localFilters.difficulty}
            onChange={(e) => handleChange('difficulty', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Difficulties</option>
            {filterOptions.difficulties.map((diff) => (
              <option key={diff} value={diff}>
                {diff}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        <div>
          <button
            onClick={handleClear}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}
