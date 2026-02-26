import { NextRequest, NextResponse } from 'next/server';
import { getResponseById } from '@/lib/db/response';
import { getResponseAgentLogsGrouped } from '@/lib/db/agent-log';

/**
 * GET /api/responses/[id]/agent-analysis
 * 
 * Get agent analysis logs for a specific response.
 * Returns logs grouped by agent type with findings.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verify response exists
    const response = await getResponseById(id);
    
    if (!response) {
      return NextResponse.json(
        { error: 'Response not found' },
        { status: 404 }
      );
    }
    
    // Get agent logs grouped by type
    const agentLogsGrouped = await getResponseAgentLogsGrouped(id);
    
    // Extract findings for each agent type
    const findings: Record<string, unknown> = {};
    
    for (const [agentType, logs] of Object.entries(agentLogsGrouped)) {
      // Get the most recent log for each agent type
      const latestLog = logs[logs.length - 1];
      if (latestLog) {
        findings[agentType.toLowerCase()] = {
          findings: latestLog.findings,
          confidence: latestLog.confidence,
          processingTime: latestLog.processingTime,
          tokensUsed: latestLog.tokensUsed,
          reflexionLoop: latestLog.reflexionLoop,
          createdAt: latestLog.createdAt,
        };
      }
    }
    
    // Format agent logs for response
    const agentLogs = Object.entries(agentLogsGrouped).flatMap(([_agentType, logs]) =>
      logs.map(log => ({
        id: log.id,
        agentType: log.agentType,
        action: log.action,
        findings: log.findings,
        confidence: log.confidence,
        processingTime: log.processingTime,
        tokensUsed: log.tokensUsed,
        reflexionLoop: log.reflexionLoop,
        createdAt: log.createdAt,
      }))
    );
    
    return NextResponse.json({
      responseId: id,
      interviewId: response.interviewId,
      agentLogs,
      findings: {
        analyzer: findings.analyzer || null,
        verifier: findings.verifier || null,
        tagger: findings.tagger || null,
        scorer: findings.scorer || null,
        narrator: findings.narrator || null,
      },
      // Include stored analysis from response if available
      agentAnalysis: (response as { agentAnalysis?: unknown }).agentAnalysis || null,
      analyzedAt: (response as { analyzedAt?: Date }).analyzedAt || null,
    });
  } catch (error) {
    console.error('Error fetching response agent analysis:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch response agent analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
