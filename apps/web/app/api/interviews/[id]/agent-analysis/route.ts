import { NextRequest, NextResponse } from 'next/server';
import { getInterviewById } from '@/lib/db/interview';
import { getAgentLogs, getAgentLogsSummary } from '@/lib/db/agent-log';

/**
 * GET /api/interviews/[id]/agent-analysis
 * 
 * Get agent analysis logs for an interview.
 * Returns all agent logs grouped by response, with a summary.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verify interview exists
    const interview = await getInterviewById(id);
    
    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }
    
    // Get all agent logs for this interview
    const agentLogs = await getAgentLogs(id);
    
    // Get summary
    const summary = await getAgentLogsSummary(id);
    
    // Group logs by responseId
    const logsByResponse: Record<string, typeof agentLogs> = {};
    for (const log of agentLogs) {
      const responseId = log.responseId || 'unknown';
      if (!logsByResponse[responseId]) {
        logsByResponse[responseId] = [];
      }
      logsByResponse[responseId].push(log);
    }
    
    return NextResponse.json({
      interviewId: id,
      agentLogs: agentLogs.map(log => ({
        id: log.id,
        responseId: log.responseId,
        agentType: log.agentType,
        action: log.action,
        findings: log.findings,
        confidence: log.confidence,
        processingTime: log.processingTime,
        tokensUsed: log.tokensUsed,
        reflexionLoop: log.reflexionLoop,
        createdAt: log.createdAt,
      })),
      logsByResponse,
      summary: {
        totalExecutions: summary.totalExecutions,
        avgConfidence: summary.avgConfidence,
        topFindings: summary.topFindings,
        byAgentType: summary.byAgentType,
      },
    });
  } catch (error) {
    console.error('Error fetching agent analysis:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch agent analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
