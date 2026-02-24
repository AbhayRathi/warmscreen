'use client';

// Type for agent types
type AgentType = 'ANALYZER' | 'VERIFIER' | 'TAGGER' | 'SCORER' | 'NARRATOR';

interface Props {
  agentType: AgentType;
  findings: Record<string, unknown>;
  showHeader?: boolean;
}

/**
 * AgentFindings - Display individual agent findings
 * 
 * A reusable component that renders findings based on agent type.
 * Can be used standalone or within AgentAnalysisPanel.
 */
export default function AgentFindings({ agentType, findings, showHeader = true }: Props) {
  const agentConfig: Record<AgentType, { icon: string; color: string; title: string }> = {
    ANALYZER: { icon: '🔍', color: 'blue', title: 'Analysis Results' },
    VERIFIER: { icon: '✓', color: 'green', title: 'Verification Results' },
    TAGGER: { icon: '🏷️', color: 'purple', title: 'Tagging Results' },
    SCORER: { icon: '📊', color: 'orange', title: 'Scoring Results' },
    NARRATOR: { icon: '📝', color: 'gray', title: 'Narrative Summary' },
  };
  
  const config = agentConfig[agentType];
  
  return (
    <div className="space-y-4">
      {showHeader && (
        <h3 className={`text-lg font-semibold text-${config.color}-700 flex items-center gap-2`}>
          <span>{config.icon}</span>
          {config.title}
        </h3>
      )}
      
      {renderFindings(agentType, findings)}
    </div>
  );
}

function renderFindings(agentType: AgentType, findings: Record<string, unknown>) {
  switch (agentType) {
    case 'ANALYZER':
      return <AnalyzerContent findings={findings} />;
    case 'VERIFIER':
      return <VerifierContent findings={findings} />;
    case 'TAGGER':
      return <TaggerContent findings={findings} />;
    case 'SCORER':
      return <ScorerContent findings={findings} />;
    case 'NARRATOR':
      return <NarratorContent findings={findings} />;
    default:
      return <DefaultContent findings={findings} />;
  }
}

// ============================================================================
// Analyzer Content
// ============================================================================

function AnalyzerContent({ findings }: { findings: Record<string, unknown> }) {
  const scores = findings.scores as Record<string, number> | undefined;
  const insights = findings.insights as string[] | undefined;
  const technicalConcepts = findings.technicalConcepts as string[] | undefined;
  const structureAnalysis = findings.structureAnalysis as {
    hasIntroduction: boolean;
    hasConclusion: boolean;
    logicalFlow: boolean;
  } | undefined;
  
  return (
    <div className="space-y-4">
      {/* Score Grid */}
      {scores && Object.keys(scores).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(scores).map(([key, value]) => (
            <div 
              key={key} 
              className={`p-3 rounded-lg text-center ${getScoreBg(value)}`}
            >
              <div className="text-xs text-gray-500 capitalize mb-1">
                {formatKey(key)}
              </div>
              <div className={`text-xl font-bold ${getScoreColor(value)}`}>
                {typeof value === 'number' ? value.toFixed(1) : '-'}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Structure Analysis */}
      {structureAnalysis && (
        <div className="flex flex-wrap gap-2">
          <StructureBadge 
            label="Introduction" 
            passed={structureAnalysis.hasIntroduction} 
          />
          <StructureBadge 
            label="Conclusion" 
            passed={structureAnalysis.hasConclusion} 
          />
          <StructureBadge 
            label="Logical Flow" 
            passed={structureAnalysis.logicalFlow} 
          />
        </div>
      )}
      
      {/* Technical Concepts */}
      {technicalConcepts && technicalConcepts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Technical Concepts</h4>
          <div className="flex flex-wrap gap-1.5">
            {technicalConcepts.map((concept, i) => (
              <span 
                key={i} 
                className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Insights */}
      {insights && insights.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Key Insights</h4>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-500 mt-0.5">💡</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Verifier Content
// ============================================================================

function VerifierContent({ findings }: { findings: Record<string, unknown> }) {
  const isConsistent = findings.isConsistent as boolean | undefined;
  const isAccurate = findings.isAccurate as boolean | undefined;
  const checks = findings.checks as Array<{
    name: string;
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }> | undefined;
  const issues = findings.issues as string[] | undefined;
  const recommendations = findings.recommendations as string[] | undefined;
  const reflexionRequired = findings.reflexionRequired as boolean | undefined;
  
  return (
    <div className="space-y-4">
      {/* Status Summary */}
      <div className="flex flex-wrap gap-3">
        <StatusIndicator label="Consistent" value={isConsistent} />
        <StatusIndicator label="Accurate" value={isAccurate} />
        {reflexionRequired && (
          <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full">
            ⟳ Reflexion Needed
          </span>
        )}
      </div>
      
      {/* Verification Checks */}
      {checks && checks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Verification Checks</h4>
          <div className="space-y-2">
            {checks.map((check, i) => (
              <div 
                key={i} 
                className={`p-3 rounded-lg border ${
                  check.passed 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {check.passed ? '✓' : '✗'} {formatKey(check.name)}
                  </span>
                  <SeverityBadge severity={check.severity} />
                </div>
                <p className="text-sm text-gray-600 mt-1">{check.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Issues */}
      {issues && issues.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-red-600 mb-2">⚠️ Issues Found</h4>
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-red-400">•</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-400">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tagger Content
// ============================================================================

function TaggerContent({ findings }: { findings: Record<string, unknown> }) {
  const skillTags = findings.skillTags as string[] | undefined;
  const behavioralTags = findings.behavioralTags as string[] | undefined;
  const competencyTags = findings.competencyTags as string[] | undefined;
  const keywords = findings.keywords as string[] | undefined;
  const sentiment = findings.sentiment as number | undefined;
  
  return (
    <div className="space-y-4">
      {/* Sentiment */}
      {sentiment !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sentiment:</span>
          <SentimentDisplay sentiment={sentiment} />
        </div>
      )}
      
      {/* Tags by Category */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Skills */}
        {skillTags && skillTags.length > 0 && (
          <TagSection 
            title="Skills" 
            tags={skillTags} 
            color="green" 
            icon="🛠️" 
          />
        )}
        
        {/* Behaviors */}
        {behavioralTags && behavioralTags.length > 0 && (
          <TagSection 
            title="Behaviors" 
            tags={behavioralTags} 
            color="purple" 
            icon="👤" 
          />
        )}
        
        {/* Competencies */}
        {competencyTags && competencyTags.length > 0 && (
          <TagSection 
            title="Competencies" 
            tags={competencyTags} 
            color="blue" 
            icon="🎯" 
          />
        )}
        
        {/* Keywords */}
        {keywords && keywords.length > 0 && (
          <TagSection 
            title="Keywords" 
            tags={keywords} 
            color="gray" 
            icon="🔑" 
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Scorer Content
// ============================================================================

function ScorerContent({ findings }: { findings: Record<string, unknown> }) {
  const overallScore = findings.overallScore as number | undefined;
  const decision = findings.decision as string | undefined;
  const decisionConfidence = findings.decisionConfidence as number | undefined;
  const componentScores = findings.componentScores as Record<string, number> | undefined;
  const breakdown = findings.breakdown as Array<{
    category: string;
    rawScore: number;
    weight: number;
    weightedScore: number;
  }> | undefined;
  
  return (
    <div className="space-y-4">
      {/* Main Score and Decision */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <div className="text-sm text-gray-500">Overall Score</div>
          <div className="text-4xl font-bold text-gray-800">
            {overallScore !== undefined ? overallScore.toFixed(1) : '-'}
            <span className="text-lg text-gray-400">/100</span>
          </div>
        </div>
        
        {decision && (
          <div className="text-right">
            <div className="text-sm text-gray-500 mb-1">Decision</div>
            <DecisionBadge decision={decision} />
            {decisionConfidence !== undefined && (
              <div className="text-xs text-gray-500 mt-1">
                {(decisionConfidence * 100).toFixed(0)}% confident
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Component Scores */}
      {componentScores && Object.keys(componentScores).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Component Scores</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(componentScores).map(([key, value]) => (
              <div 
                key={key} 
                className={`p-2 rounded text-center ${getScoreBg(value)}`}
              >
                <div className="text-xs text-gray-500 capitalize">{formatKey(key)}</div>
                <div className={`text-lg font-semibold ${getScoreColor(value)}`}>
                  {value.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Breakdown */}
      {breakdown && breakdown.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Score Breakdown</h4>
          <div className="space-y-2">
            {breakdown.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-24 text-sm text-gray-600 capitalize">
                  {formatKey(item.category)}
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${(item.rawScore / 10) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right text-sm font-medium">
                  {item.rawScore.toFixed(1)}/10
                </div>
                <div className="w-12 text-right text-xs text-gray-400">
                  ({(item.weight * 100).toFixed(0)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Narrator Content
// ============================================================================

function NarratorContent({ findings }: { findings: Record<string, unknown> }) {
  const summary = findings.summary as string | undefined;
  const _detailedExplanation = findings.detailedExplanation as string | undefined;
  const strengths = findings.strengths as string[] | undefined;
  const weaknesses = findings.weaknesses as string[] | undefined;
  const recommendations = findings.recommendations as string[] | undefined;
  const keyFactors = findings.keyFactors as Array<{
    factor: string;
    impact: number;
    evidence: string[];
  }> | undefined;
  
  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-400">
          <p className="text-gray-700 leading-relaxed">{summary}</p>
        </div>
      )}
      
      {/* Strengths and Weaknesses */}
      <div className="grid sm:grid-cols-2 gap-4">
        {strengths && strengths.length > 0 && (
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="text-sm font-semibold text-green-700 mb-2">✓ Strengths</h4>
            <ul className="space-y-1">
              {strengths.map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {weaknesses && weaknesses.length > 0 && (
          <div className="p-4 bg-red-50 rounded-lg">
            <h4 className="text-sm font-semibold text-red-700 mb-2">△ Areas for Improvement</h4>
            <ul className="space-y-1">
              {weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Key Factors */}
      {keyFactors && keyFactors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Key Decision Factors</h4>
          <div className="space-y-2">
            {keyFactors.map((factor, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{factor.factor}</span>
                  <ImpactBadge impact={factor.impact} />
                </div>
                {factor.evidence.length > 0 && (
                  <ul className="text-xs text-gray-500">
                    {factor.evidence.map((e, j) => (
                      <li key={j}>• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-400">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Default Content
// ============================================================================

function DefaultContent({ findings }: { findings: Record<string, unknown> }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <pre className="text-xs text-gray-600 overflow-auto whitespace-pre-wrap">
        {JSON.stringify(findings, null, 2)}
      </pre>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function StructureBadge({ label, passed }: { label: string; passed: boolean }) {
  return (
    <span className={`px-2 py-1 text-xs rounded-full ${
      passed 
        ? 'bg-green-100 text-green-700' 
        : 'bg-gray-100 text-gray-500'
    }`}>
      {passed ? '✓' : '○'} {label}
    </span>
  );
}

function StatusIndicator({ label, value }: { label: string; value: boolean | undefined }) {
  if (value === undefined) return null;
  
  return (
    <span className={`px-3 py-1 text-sm rounded-full font-medium ${
      value 
        ? 'bg-green-100 text-green-700' 
        : 'bg-red-100 text-red-700'
    }`}>
      {value ? '✓' : '✗'} {label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${colors[severity]}`}>
      {severity}
    </span>
  );
}

function SentimentDisplay({ sentiment }: { sentiment: number }) {
  let color = 'bg-gray-100 text-gray-700';
  let label = 'Neutral';
  let emoji = '😐';
  
  if (sentiment > 0.3) {
    color = 'bg-green-100 text-green-700';
    label = 'Positive';
    emoji = '😊';
  } else if (sentiment < -0.3) {
    color = 'bg-red-100 text-red-700';
    label = 'Negative';
    emoji = '😕';
  }
  
  return (
    <span className={`px-2 py-1 text-sm rounded-full inline-flex items-center gap-1 ${color}`}>
      {emoji} {label} ({sentiment.toFixed(2)})
    </span>
  );
}

function TagSection({ 
  title, 
  tags, 
  color, 
  icon 
}: { 
  title: string; 
  tags: string[]; 
  color: string; 
  icon: string;
}) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-100 text-green-700 border-green-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-600 mb-2">
        {icon} {title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <span 
            key={i} 
            className={`px-2 py-1 text-xs rounded-full border ${colorClasses[color]}`}
          >
            {formatKey(tag)}
          </span>
        ))}
      </div>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const colors: Record<string, string> = {
    STRONG_HIRE: 'bg-green-500 text-white',
    HIRE: 'bg-blue-500 text-white',
    NO_HIRE: 'bg-yellow-500 text-white',
    STRONG_NO_HIRE: 'bg-red-500 text-white',
  };
  
  return (
    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${colors[decision] || 'bg-gray-500 text-white'}`}>
      {decision.replace(/_/g, ' ')}
    </span>
  );
}

function ImpactBadge({ impact }: { impact: number }) {
  let color = 'bg-gray-100 text-gray-600';
  let label = 'Neutral';
  
  if (impact > 0.3) {
    color = 'bg-green-100 text-green-700';
    label = 'Positive';
  } else if (impact < -0.3) {
    color = 'bg-red-100 text-red-700';
    label = 'Negative';
  }
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${color}`}>
      {impact > 0 ? '+' : ''}{(impact * 100).toFixed(0)}% {label}
    </span>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function getScoreColor(value: number): string {
  if (value >= 8) return 'text-green-600';
  if (value >= 6) return 'text-blue-600';
  if (value >= 4) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBg(value: number): string {
  if (value >= 8) return 'bg-green-50';
  if (value >= 6) return 'bg-blue-50';
  if (value >= 4) return 'bg-yellow-50';
  return 'bg-red-50';
}
