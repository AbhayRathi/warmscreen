'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetcher, apiPost } from '@/lib/api';

interface VoiceTranscript {
  text: string;
  confidence?: number;
  timestamp?: number;
}

export default function InterviewStartPage() {
  const params = useParams();
  const router = useRouter();
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'starting' | 'active' | 'ending'>('idle');
  const [voiceSession, setVoiceSession] = useState<any | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceTranscripts, setVoiceTranscripts] = useState<VoiceTranscript[]>([]);
  const [fullTranscript, setFullTranscript] = useState('');
  const [cloneForm, setCloneForm] = useState({ voiceName: '', sampleUrl: '', description: '' });
  const [cloneStatus, setCloneStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [cloneResponse, setCloneResponse] = useState<any | null>(null);

  useEffect(() => {
    if (!params.id) return;

    fetcher(`/api/interviews/${params.id}`)
      .then((data) => {
        setInterview(data.interview);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch interview:', err);
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (voiceStatus === 'active') {
      interval = setInterval(() => {
        fetcher('/api/voice/transcripts')
          .then((data) => {
            setVoiceTranscripts(data.transcripts || []);
            setFullTranscript(data.fullTranscript || '');
          })
          .catch((err) => console.error('Failed to fetch transcripts:', err));
      }, 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [voiceStatus]);

  const startInterview = async () => {
    setStarting(true);
    try {
      const data = await apiPost(`/api/interviews/${params.id}/start`, {});
      setInterview(data.interview);
      setQuestions(data.questions);
      await startVoiceSession(data.interview);
    } catch (err) {
      console.error('Failed to start interview:', err);
      alert('Failed to start interview. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const startVoiceSession = async (interviewContext?: any) => {
    const activeInterview = interviewContext || interview;
    if (!activeInterview || voiceStatus === 'active' || voiceStatus === 'starting') return;

    setVoiceError(null);
    setVoiceStatus('starting');
    try {
      const session = await apiPost('/api/voice/session/start', {
        interviewId: activeInterview.id,
        participantName: activeInterview.candidateName,
      });
      setVoiceSession(session.session);
      setVoiceStatus('active');
    } catch (err) {
      console.error('Failed to start voice session:', err);
      setVoiceError('Unable to start voice agent. Please verify LiveKit/Deepgram credentials.');
      setVoiceStatus('idle');
      throw err;
    }
  };

  const endVoiceSession = async () => {
    if (voiceStatus !== 'active') return;
    setVoiceStatus('ending');
    try {
      await apiPost('/api/voice/session/end', {});
      setVoiceSession(null);
      setVoiceStatus('idle');
    } catch (err) {
      console.error('Failed to end voice session:', err);
      setVoiceStatus('active');
      setVoiceError('Unable to end voice session. Try again.');
    }
  };

  const handleCloneVoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cloneForm.voiceName || !cloneForm.sampleUrl) {
      setVoiceError('Voice name and sample URL are required.');
      return;
    }

    setCloneStatus('submitting');
    setVoiceError(null);
    try {
      const response = await apiPost('/api/voice/clone', cloneForm);
      setCloneResponse(response.clone);
      setCloneStatus('success');
    } catch (err) {
      console.error('Failed to clone voice:', err);
      setCloneStatus('error');
      setVoiceError('Voice cloning failed. Double-check AGI API access.');
    }
  };

  const updateCloneField = (field: keyof typeof cloneForm, value: string) => {
    setCloneForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitResponse = async () => {
    if (!transcript.trim()) {
      alert('Please provide an answer');
      return;
    }

    setSubmitting(true);
    try {
      await apiPost(`/api/interviews/${params.id}/responses`, {
        questionId: questions[currentQuestionIndex].id,
        transcript,
        duration: 0,
      });

      setTranscript('');

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        await apiPost(`/api/interviews/${params.id}/complete`, {});
        router.push(`/interviews/${params.id}/results`);
      }
    } catch (err) {
      console.error('Failed to submit response:', err);
      alert('Failed to submit response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold">Loading interview...</div>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-4">Interview not found</div>
          <Link href="/interviews" className="text-indigo-600 hover:text-indigo-800">
            ← Back to Interviews
          </Link>
        </div>
      </div>
    );
  }

  if (interview.status === 'COMPLETED') {
    router.push(`/interviews/${params.id}`);
    return null;
  }

  if (interview.status === 'SCHEDULED' || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">Welcome to Your Interview</h1>
              <p className="text-xl text-gray-600 mb-2">{interview.candidateName}</p>
              <p className="text-lg text-gray-500">Position: {interview.position}</p>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-2">Interview Instructions</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>You will be asked 5 questions about the position</li>
                <li>Take your time to provide thoughtful answers</li>
                <li>Responses are analyzed by the 7-agent swarm + reflexion loop</li>
                <li>Average duration is 15-20 minutes</li>
              </ul>
            </div>

            {voiceError && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {voiceError}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-indigo-50 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-2">Voice Agent</h3>
                <p className="text-sm text-gray-600 mb-4">
                  LiveKit + Deepgram capture authenticated audio and transcripts in real time.
                </p>
                <button
                  type="button"
                  onClick={() => startVoiceSession(interview)}
                  disabled={voiceStatus === 'starting' || voiceStatus === 'active'}
                  className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold disabled:bg-gray-400"
                >
                  {voiceStatus === 'starting'
                    ? 'Starting Voice Agent...'
                    : voiceStatus === 'active'
                    ? 'Voice Agent Active'
                    : 'Start Voice Agent'}
                </button>
                {voiceSession && (
                  <p className="mt-3 text-xs text-gray-600">
                    Room: {voiceSession.roomUrl} · Token issued
                  </p>
                )}
              </div>

              <div className="bg-white border rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-2">Clone a Voice</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Use the AGI voice lab to duplicate recruiter tone or candidate timbre.
                </p>
                <form className="space-y-3" onSubmit={handleCloneVoice}>
                  <input
                    type="text"
                    placeholder="Voice Name"
                    value={cloneForm.voiceName}
                    onChange={(e) => updateCloneField('voiceName', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="url"
                    placeholder="Sample Audio URL"
                    value={cloneForm.sampleUrl}
                    onChange={(e) => updateCloneField('sampleUrl', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <textarea
                    placeholder="Describe the tone / intent (optional)"
                    value={cloneForm.description}
                    onChange={(e) => updateCloneField('description', e.target.value)}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={cloneStatus === 'submitting'}
                    className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold disabled:bg-gray-400"
                  >
                    {cloneStatus === 'submitting' ? 'Cloning Voice...' : 'Clone Voice'}
                  </button>
                </form>
                {cloneResponse && (
                  <div className="mt-3 text-xs text-green-700">
                    Voice cloned (ID: {cloneResponse.voiceId}) · status: {cloneResponse.status}
                  </div>
                )}
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={startInterview}
                disabled={starting}
                className="bg-indigo-600 text-white px-12 py-4 rounded-lg text-xl font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {starting ? 'Starting...' : 'Start Interview'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold mb-4">
                {currentQuestion.category}
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentQuestion.content}</h2>
              <div className="flex gap-2 mt-4 flex-wrap">
                {currentQuestion.skillTags?.map((tag: string, i: number) => (
                  <span
                    key={`${tag}-${i}`}
                    className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Answer</label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={8}
                placeholder="Type your answer here..."
              />
              <div className="mt-2 text-sm text-gray-500">
                {transcript.split(' ').filter(Boolean).length} words
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                💡 Tip: Be specific and provide examples from your experience
              </div>
              <button
                onClick={submitResponse}
                disabled={submitting || !transcript.trim()}
                className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {submitting
                  ? 'Submitting...'
                  : currentQuestionIndex < questions.length - 1
                  ? 'Next Question'
                  : 'Complete Interview'}
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Voice Agent</h3>
                  <p className="text-sm text-gray-500">LiveKit + Deepgram session</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  {voiceStatus === 'active'
                    ? 'Recording'
                    : voiceStatus === 'starting'
                    ? 'Starting'
                    : 'Idle'}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => startVoiceSession()}
                    disabled={voiceStatus === 'active' || voiceStatus === 'starting'}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold disabled:bg-gray-400"
                  >
                    {voiceStatus === 'active' ? 'Voice Running' : 'Start Voice'}
                  </button>
                  <button
                    type="button"
                    onClick={endVoiceSession}
                    disabled={voiceStatus !== 'active'}
                    className="flex-1 border border-gray-300 py-2 rounded-lg font-semibold disabled:text-gray-400"
                  >
                    Stop
                  </button>
                </div>
                {voiceSession && (
                  <div className="text-xs text-gray-600">
                    Room: {voiceSession.roomUrl} · Token ready for WebRTC client
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold mb-3">Live Transcript</h3>
              {voiceTranscripts.length === 0 ? (
                <p className="text-sm text-gray-500">No transcript yet. Start speaking to capture audio.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-3 text-sm">
                  {voiceTranscripts.map((t, idx) => (
                    <div key={t.timestamp || idx} className="border-l-2 border-indigo-200 pl-3">
                      <p className="text-gray-800">{t.text}</p>
                      {typeof t.confidence === 'number' && (
                        <span className="text-xs text-gray-500">
                          Confidence {(t.confidence * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {fullTranscript && (
                <div className="mt-4 text-xs text-gray-500">
                  Full transcript snapshot: {fullTranscript}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold mb-2">Interview Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Candidate:</span>
                <div className="font-medium">{interview.candidateName}</div>
              </div>
              <div>
                <span className="text-gray-600">Position:</span>
                <div className="font-medium">{interview.position}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
