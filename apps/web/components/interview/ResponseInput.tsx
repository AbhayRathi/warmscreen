'use client';

import { useState, useEffect, useRef } from 'react';

interface ResponseInputProps {
  onSubmit: (transcript: string, duration: number) => void;
  isLoading: boolean;
  questionId: string;
}

function getInitialText(questionId: string): string {
  if (typeof window !== 'undefined') {
    const draftKey = `interview_draft_${questionId}`;
    return localStorage.getItem(draftKey) || '';
  }
  return '';
}

// Inner component that gets reset via key prop
function ResponseInputInner({
  onSubmit,
  isLoading,
  questionId,
}: ResponseInputProps) {
  // Initialize text with saved draft - use function initializer
  const [text, setText] = useState(() => getInitialText(questionId));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date>(new Date());

  // Timer effect - runs once on mount
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (questionId) {
      const draftKey = `interview_draft_${questionId}`;
      if (text) {
        localStorage.setItem(draftKey, text);
      }
    }
  }, [text, questionId]);

  const handleSubmit = () => {
    if (!text.trim() || isLoading) return;

    const duration = elapsedSeconds;
    
    // Clear draft from localStorage
    const draftKey = `interview_draft_${questionId}`;
    localStorage.removeItem(draftKey);
    
    onSubmit(text.trim(), duration);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
          placeholder="Type your answer here..."
          className="w-full h-48 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
        />
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">
          <span className="mr-4">Characters: {text.length}</span>
          <span>Time: {formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!text.trim() || isLoading}
        className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Submitting...
          </>
        ) : (
          'Submit Answer'
        )}
      </button>
    </div>
  );
}

// Wrapper that uses key prop to reset state on question change
export default function ResponseInput(props: ResponseInputProps) {
  return <ResponseInputInner key={props.questionId} {...props} />;
}
