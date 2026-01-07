import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getUserInterviews } from '@/lib/db/interview';

export default async function DashboardPage() {
  const session = await getSession();
  
  if (!session.isLoggedIn) {
    redirect('/auth/signin');
  }
  
  const interviews = await getUserInterviews(session.userId);

  const totalInterviews = interviews.length;
  const completedInterviews = interviews.filter(
    (i) => i.status === 'COMPLETED'
  ).length;
  const avgScore = interviews
    .filter((i) => i.score)
    .reduce((sum, i) => sum + (i.score || 0), 0) / (completedInterviews || 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {session.name}</p>
          </div>
          <Link
            href="/"
            className="text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-2">Total Interviews</div>
            <div className="text-3xl font-bold text-indigo-600">{totalInterviews}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-2">Completed</div>
            <div className="text-3xl font-bold text-green-600">{completedInterviews}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-2">Average Score</div>
            <div className="text-3xl font-bold text-blue-600">
              {completedInterviews > 0 ? avgScore.toFixed(1) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Interviews List */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Your Interviews</h2>
            <Link 
              href="/interviews"
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
            >
              Create New Interview
            </Link>
          </div>

          {interviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No interviews yet. Create your first one!</p>
              <Link 
                href="/interviews"
                className="text-indigo-600 hover:underline"
              >
                Get Started →
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {interviews.map((interview) => (
                <div 
                  key={interview.id} 
                  className="border rounded-lg p-4 hover:shadow-lg transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        {interview.candidateName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {interview.candidateEmail}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Position: <span className="font-medium">{interview.position}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Scheduled: {new Date(interview.scheduledAt).toLocaleDateString()}
                      </p>
                      {interview.score && (
                        <p className="text-sm text-gray-600 mt-1">
                          Score: <span className="font-bold text-indigo-600">{interview.score}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        interview.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        interview.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                        interview.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {interview.status.replace('_', ' ')}
                      </span>
                      <Link 
                        href={`/interviews/${interview.id}`}
                        className="text-indigo-600 hover:underline text-sm"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
