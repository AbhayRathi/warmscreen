'use client';

import { useState } from 'react';

// Type for agent types
type AgentType = 'ANALYZER' | 'VERIFIER' | 'TAGGER' | 'SCORER' | 'NARRATOR';

// Interface for agent log data
interface AgentLog {
  id: string;
  agentType: AgentType;
  action: string;
  findings: Record<string, unknown> | null;
  confidence: number | null;
  processingTime: number | null;
  tokensUsed: number | null;
  reflexionLoop: number;
  createdAt: string;
}

interface Props {
  agentLogs: AgentLog[];
}

/**
 * AgentAnalysisPanel - Tabbed interface for displaying agent findings
 * 
 * Shows findings from each agent in the analysis pipeline:
 * - Analyzer: Technical analysis and scores
 * - Verifier: Consistency and accuracy checks
 * - Tagger: Extracted skills and behaviors
 * - Scorer: Overall scores and decision
 * - Narrator: Human-readable summary
 */
export default function AgentAnalysisPanel({ agentLogs }: Props) {
  const [activeTab, setActiveTab] = useState<AgentType>('ANALYZER');
  
  // Group logs by agent type
  const logsByType = agentLogs.reduce((acc, log) => {
    if (!acc[log.agentType]) {
      acc[log.agentType] = [];
    }
    acc[log.agentType].push(log);
    return acc;
  }, {} as Record<AgentType, AgentLog[]>);
  
  // Get the latest log for each agent type
  const getLatestLog = (type: AgentType): AgentLog | null => {
    const logs = logsByType[type];
    if (!logs || logs.length === 0) return null;
    return logs[logs.length - 1];
  };
  
  // Tabs configuration
  const tabs: { type: AgentType; label: string; icon: string }[] = [
    { type: 'ANALYZER', label: 'Analyzer', icon: '🔍' },
    { type: 'VERIFIER', label: 'Verifier', icon: '✓' },
    { type: 'TAGGER', label: 'Tagger', icon: '🏷️' },
    { type: 'SCORER', label: 'Scorer', icon: '📊' },
    { type: 'NARRATOR', label: 'Narrator', icon: '📝' },
  ];
  
  // Get confidence color
  const getConfidenceColor = (confidence: number | null): string => {
    if (confidence === null) return 'text-gray-400';
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  // Get confidence background
  const getConfidenceBg = (confidence: number | null): string => {
    if (confidence === null) return 'bg-gray-100';
    if (confidence >= 0.8) return 'bg-green-100';
    if (confidence >= 0.6) return 'bg-yellow-100';
    return 'bg-red-100';
  };
  
  const activeLog = getLatestLog(activeTab);
  
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px overflow-x-auto">
          {tabs.map((tab) => {
            const hasData = !!logsByType[tab.type]?.length;
            const isActive = activeTab === tab.type;
            
            return (
              <button
                key={tab.type}
                onClick={() => setActiveTab(tab.type)}
                className={`
                  flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${isActive 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                  ${!hasData && 'opacity-50'}
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {hasData && (
                  <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                    isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {logsByType[tab.type].length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="p-4">
        {activeLog ? (
          <div className="space-y-4">
            {/* Confidence and Stats Bar */}
            <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg">
              {/* Confidence */}
              <div className={`px-3 py-2 rounded-lg ${getConfidenceBg(activeLog.confidence)}`}>
                <div className="text-xs text-gray-500">Confidence</div>
                <div className={`text-lg font-bold ${getConfidenceColor(activeLog.confidence)}`}>
                  {activeLog.confidence !== null 
                    ? `${(activeLog.confidence * 100).toFixed(0)}%` 
                    : '-'}
                </div>
              </div>
              
              {/* Processing Time */}
              <div className="px-3 py-2 bg-blue-50 rounded-lg">
                <div className="text-xs text-gray-500">Processing Time</div>
                <div className="text-lg font-bold text-blue-600">
                  {activeLog.processingTime !== null 
                    ? `${activeLog.processingTime}ms` 
                    : '-'}
                </div>
              </div>
              
              {/* Tokens Used */}
              {activeLog.tokensUsed !== null && (
                <div className="px-3 py-2 bg-purple-50 rounded-lg">
                  <div className="text-xs text-gray-500">Tokens Used</div>
                  <div className="text-lg font-bold text-purple-600">
                    {activeLog.tokensUsed}
                  </div>
                </div>
              )}
              
              {/* Reflexion Loops */}
              {activeLog.reflexionLoop > 0 && (
                <div className="px-3 py-2 bg-orange-50 rounded-lg">
                  <div className="text-xs text-gray-500">Reflexion Loops</div>
                  <div className="text-lg font-bold text-orange-600">
                    {activeLog.reflexionLoop}
                  </div>
                </div>
              )}
            </div>
            
            {/* Findings */}
            {activeLog.findings && (
              <AgentFindings 
                agentType={activeTab} 
                findings={activeLog.findings} 
              />
            )}
            
            {/* Timestamp */}
            <div className="text-xs text-gray-400 text-right">
              Analyzed: {new Date(activeLog.createdAt).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No {activeTab.toLowerCase()} data available</p>
            <p className="text-sm mt-2">Run the analysis to see results</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AgentFindings Component - Display individual agent findings
// ============================================================================

interface AgentFindingsProps {
  agentType: AgentType;
  findings: Record<string, unknown>;
}

function AgentFindings({ agentType, findings }: AgentFindingsProps) {
  switch (agentType) {
    case 'ANALYZER':
      return <AnalyzerFindings findings={findings} />;
    case 'VERIFIER':
      return <VerifierFindings findings={findings} />;
    case 'TAGGER':
      return <TaggerFindings findings={findings} />;
    case 'SCORER':
      return <ScorerFindings findings={findings} />;
    case 'NARRATOR':
      return <NarratorFindings findings={findings} />;
    default:
      return <GenericFindings findings={findings} />;
  }
}

// ============================================================================
// Agent-Specific Finding Components
// ============================================================================

function AnalyzerFindings({ findings }: { findings: Record<string, unknown> }) {
  const scores = findings.scores as Record<string, number> | undefined;
  const insights = findings.insights as string[] | undefined;
  const technicalConcepts = findings.technicalConcepts as string[] | undefined;
  
  return (
    <div className="space-y-4">
      {/* Scores */}
      {scores && Object.keys(scores).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Scores</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(scores).map(([key, value]) => (
              <ScoreBox key={key} label={formatLabel(key)} value={value} />
            ))}
          </div>
        </div>
      )}
      
      {/* Insights */}
      {insights && insights.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Insights</h4>
          <ul className="space-y-1">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start text-sm">
                <span className="text-blue-500 mr-2">•</span>
                <span className="text-gray-600">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Technical Concepts */}
      {technicalConcepts && technicalConcepts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Technical Concepts Mentioned</h4>
          <div className="flex flex-wrap gap-2">
            {technicalConcepts.map((concept, i) => (
              <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VerifierFindings({ findings }: { findings: Record<string, unknown> }) {
  const isConsistent = findings.isConsistent as boolean | undefined;
  const isAccurate = findings.isAccurate as boolean | undefined;
  const checks = findings.checks as Array<{ name: string; passed: boolean; message: string; severity: string }> | undefined;
  const issues = findings.issues as string[] | undefined;
  const recommendations = findings.recommendations as string[] | undefined;
  
  return (
    <div className="space-y-4">
      {/* Status Indicators */}
      <div className="flex gap-4">
        <StatusBadge 
          label="Consistent" 
          passed={isConsistent} 
        />
        <StatusBadge 
          label="Accurate" 
          passed={isAccurate} 
        />
      </div>
      
      {/* Checks */}
      {checks && checks.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Verification Checks</h4>
          <div className="space-y-2">
            {checks.map((check, i) => (
              <div key={i} className={`p-2 rounded text-sm ${
                check.passed ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center">
                  <span className={check.passed ? 'text-green-600' : 'text-red-600'}>
                    {check.passed ? '✓' : '✗'}
                  </span>
                  <span className="ml-2 font-medium">{formatLabel(check.name)}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                    check.severity === 'high' ? 'bg-red-100 text-red-700' :
                    check.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {check.severity}
                  </span>
                </div>
                <p className="ml-6 text-gray-600">{check.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Issues */}
      {issues && issues.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-700 mb-2">Issues Found</h4>
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start text-sm">
                <span className="text-red-500 mr-2">⚠</span>
                <span className="text-gray-600">{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start text-sm">
                <span className="text-blue-500 mr-2">→</span>
                <span className="text-gray-600">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TaggerFindings({ findings }: { findings: Record<string, unknown> }) {
  const skillTags = findings.skillTags as string[] | undefined;
  const behavioralTags = findings.behavioralTags as string[] | undefined;
  const competencyTags = findings.competencyTags as string[] | undefined;
  const sentiment = findings.sentiment as number | undefined;
  
  return (
    <div className="space-y-4">
      {/* Sentiment */}
      {sentiment !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Sentiment:</span>
          <SentimentBadge sentiment={sentiment} />
        </div>
      )}
      
      {/* Skill Tags */}
      {skillTags && skillTags.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Skills</h4>
          <div className="flex flex-wrap gap-2">
            {skillTags.map((tag, i) => (
              <span key={i} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                {formatLabel(tag)}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Behavioral Tags */}
      {behavioralTags && behavioralTags.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Behavioral Indicators</h4>
          <div className="flex flex-wrap gap-2">
            {behavioralTags.map((tag, i) => (
              <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                {formatLabel(tag)}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Competency Tags */}
      {competencyTags && competencyTags.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Competencies</h4>
          <div className="flex flex-wrap gap-2">
            {competencyTags.map((tag, i) => (
              <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {formatLabel(tag)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScorerFindings({ findings }: { findings: Record<string, unknown> }) {
  const overallScore = findings.overallScore as number | undefined;
  const decision = findings.decision as string | undefined;
  const componentScores = findings.componentScores as Record<string, number> | undefined;
  const breakdown = findings.breakdown as Array<{ category: string; rawScore: number; weight: number; weightedScore: number }> | undefined;
  
  const getDecisionColor = (dec: string | undefined) => {
    if (!dec) return 'bg-gray-100 text-gray-800';
    if (dec === 'STRONG_HIRE') return 'bg-green-100 text-green-800';
    if (dec === 'HIRE') return 'bg-blue-100 text-blue-800';
    if (dec === 'NO_HIRE') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };
  
  return (
    <div className="space-y-4">
      {/* Overall Score and Decision */}
      <div className="flex items-center gap-4">
        {overallScore !== undefined && (
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-800">
              {overallScore.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">out of 100</div>
          </div>
        )}
        
        {decision && (
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getDecisionColor(decision)}`}>
            {decision.replace(/_/g, ' ')}
          </span>
        )}
      </div>
      
      {/* Component Scores */}
      {componentScores && Object.keys(componentScores).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Component Scores</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(componentScores).map(([key, value]) => (
              <ScoreBox key={key} label={formatLabel(key)} value={value} />
            ))}
          </div>
        </div>
      )}
      
      {/* Breakdown */}
      {breakdown && breakdown.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Score Breakdown</h4>
          <div className="space-y-2">
            {breakdown.map((item, i) => (
              <div key={i} className="flex items-center text-sm">
                <span className="w-32 text-gray-600">{formatLabel(item.category)}</span>
                <div className="flex-1 mx-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(item.rawScore / 10) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-16 text-right text-gray-800 font-medium">
                  {item.rawScore.toFixed(1)}/10
                </span>
                <span className="w-16 text-right text-gray-500 text-xs">
                  ({(item.weight * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NarratorFindings({ findings }: { findings: Record<string, unknown> }) {
  const summary = findings.summary as string | undefined;
  const strengths = findings.strengths as string[] | undefined;
  const weaknesses = findings.weaknesses as string[] | undefined;
  const recommendations = findings.recommendations as string[] | undefined;
  
  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-700">{summary}</p>
        </div>
      )}
      
      {/* Strengths and Weaknesses */}
      <div className="grid md:grid-cols-2 gap-4">
        {strengths && strengths.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-green-700 mb-2">✓ Strengths</h4>
            <ul className="space-y-1">
              {strengths.map((item, i) => (
                <li key={i} className="flex items-start text-sm">
                  <span className="text-green-500 mr-2">•</span>
                  <span className="text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {weaknesses && weaknesses.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-red-700 mb-2">△ Areas for Improvement</h4>
            <ul className="space-y-1">
              {weaknesses.map((item, i) => (
                <li key={i} className="flex items-start text-sm">
                  <span className="text-red-500 mr-2">•</span>
                  <span className="text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start text-sm">
                <span className="text-blue-500 mr-2">→</span>
                <span className="text-gray-600">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GenericFindings({ findings }: { findings: Record<string, unknown> }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <pre className="text-xs text-gray-600 overflow-auto">
        {JSON.stringify(findings, null, 2)}
      </pre>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ScoreBox({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 8) return 'bg-green-100 text-green-700';
    if (v >= 6) return 'bg-blue-100 text-blue-700';
    if (v >= 4) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };
  
  return (
    <div className={`p-2 rounded-lg text-center ${getColor(value)}`}>
      <div className="text-xs text-gray-600 capitalize">{label}</div>
      <div className="text-lg font-bold">{value.toFixed(1)}</div>
    </div>
  );
}

function StatusBadge({ label, passed }: { label: string; passed: boolean | undefined }) {
  if (passed === undefined) return null;
  
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
      passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {passed ? '✓' : '✗'} {label}
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: number }) {
  let color = 'bg-gray-100 text-gray-700';
  let label = 'Neutral';
  
  if (sentiment > 0.3) {
    color = 'bg-green-100 text-green-700';
    label = 'Positive';
  } else if (sentiment < -0.3) {
    color = 'bg-red-100 text-red-700';
    label = 'Negative';
  }
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {label} ({sentiment.toFixed(2)})
    </span>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}
