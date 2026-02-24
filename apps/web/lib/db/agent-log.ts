import prisma from './prisma';
import { z } from 'zod';
import { AgentType } from '@warmscreen/database';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const CreateAgentLogSchema = z.object({
  interviewId: z.string().min(1, 'Interview ID is required'),
  responseId: z.string().min(1, 'Response ID is required'),
  agentType: z.enum(['ANALYZER', 'VERIFIER', 'PLANNER', 'CONDUCTOR', 'TAGGER', 'SCORER', 'NARRATOR']),
  findings: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  processingTime: z.number().int().min(0).optional(),
  tokensUsed: z.number().int().min(0).optional(),
  action: z.string().default('analyze'),
  input: z.record(z.string(), z.unknown()).default({}),
  output: z.record(z.string(), z.unknown()).default({}),
  reflexionLoop: z.number().int().min(0).default(0),
  performanceScore: z.number().min(0).max(1).optional(),
});

export const AgentMetricsQuerySchema = z.object({
  agentType: z.enum(['ANALYZER', 'VERIFIER', 'PLANNER', 'CONDUCTOR', 'TAGGER', 'SCORER', 'NARRATOR']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// ============================================================================
// Type Definitions
// ============================================================================

export type CreateAgentLogInput = z.infer<typeof CreateAgentLogSchema>;
export type AgentMetricsQuery = z.infer<typeof AgentMetricsQuerySchema>;

// Type alias for AgentLog from Prisma
type AgentLogType = Awaited<ReturnType<typeof prisma.agentLog.findFirst>> & {};

export interface AgentLogWithDetails extends NonNullable<AgentLogType> {
  interview?: {
    id: string;
    candidateName: string;
    position: string;
  };
}

export interface AgentMetrics {
  agentType: AgentType;
  avgConfidence: number;
  avgProcessingTime: number;
  avgTokensUsed: number;
  totalExecutions: number;
  successRate: number;
}

export interface AgentLogsByResponse {
  responseId: string;
  logs: AgentLogWithDetails[];
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new agent execution log
 */
export async function createAgentLog(
  data: CreateAgentLogInput
): Promise<AgentLogType> {
  const validated = CreateAgentLogSchema.parse(data);
  
  return await prisma.agentLog.create({
    data: {
      interviewId: validated.interviewId,
      responseId: validated.responseId,
      agentType: validated.agentType as AgentType,
      action: validated.action,
      input: validated.input as object,
      output: validated.output as object,
      findings: (validated.findings as object) || null,
      confidence: validated.confidence || null,
      processingTime: validated.processingTime || null,
      tokensUsed: validated.tokensUsed || null,
      reflexionLoop: validated.reflexionLoop,
      performanceScore: validated.performanceScore || null,
    },
  });
}

/**
 * Get all agent logs for an interview, ordered by createdAt
 */
export async function getAgentLogs(
  interviewId: string
): Promise<AgentLogWithDetails[]> {
  const logs = await prisma.agentLog.findMany({
    where: { interviewId },
    orderBy: { createdAt: 'asc' },
    include: {
      interview: {
        select: {
          id: true,
          candidateName: true,
          position: true,
        },
      },
    },
  });
  
  return logs as AgentLogWithDetails[];
}

/**
 * Get agent logs for a specific response, grouped by agentType
 */
export async function getResponseAgentLogs(
  responseId: string
): Promise<Map<AgentType, AgentLogWithDetails[]>> {
  const logs = await prisma.agentLog.findMany({
    where: { responseId },
    orderBy: { createdAt: 'asc' },
    include: {
      interview: {
        select: {
          id: true,
          candidateName: true,
          position: true,
        },
      },
    },
  });
  
  // Group by agentType
  const grouped = new Map<AgentType, AgentLogWithDetails[]>();
  
  for (const log of logs) {
    const agentType = log.agentType;
    if (!grouped.has(agentType)) {
      grouped.set(agentType, []);
    }
    grouped.get(agentType)!.push(log as AgentLogWithDetails);
  }
  
  return grouped;
}

/**
 * Get agent logs for a response as a plain object (for API responses)
 */
export async function getResponseAgentLogsGrouped(
  responseId: string
): Promise<Record<string, AgentLogWithDetails[]>> {
  const grouped = await getResponseAgentLogs(responseId);
  const result: Record<string, AgentLogWithDetails[]> = {};
  
  for (const [agentType, logs] of grouped) {
    result[agentType] = logs;
  }
  
  return result;
}

/**
 * Calculate performance metrics by agent type
 */
export async function getAgentMetrics(
  query?: AgentMetricsQuery
): Promise<AgentMetrics[]> {
  const validated = query ? AgentMetricsQuerySchema.parse(query) : {};
  
  // Build where clause
  const where: {
    agentType?: AgentType;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};
  
  if (validated.agentType) {
    where.agentType = validated.agentType as AgentType;
  }
  
  if (validated.startDate || validated.endDate) {
    where.createdAt = {};
    if (validated.startDate) {
      where.createdAt.gte = validated.startDate;
    }
    if (validated.endDate) {
      where.createdAt.lte = validated.endDate;
    }
  }
  
  // Get all agent types to calculate metrics for
  const agentTypes: AgentType[] = validated.agentType 
    ? [validated.agentType as AgentType]
    : ['ANALYZER', 'VERIFIER', 'PLANNER', 'CONDUCTOR', 'TAGGER', 'SCORER', 'NARRATOR'];
  
  const metrics: AgentMetrics[] = [];
  
  for (const agentType of agentTypes) {
    const logs = await prisma.agentLog.findMany({
      where: {
        ...where,
        agentType,
      },
      select: {
        confidence: true,
        processingTime: true,
        tokensUsed: true,
        performanceScore: true,
      },
    });
    
    if (logs.length === 0) {
      continue;
    }
    
    // Calculate averages
    const validConfidences = logs.filter(l => l.confidence !== null).map(l => l.confidence!);
    const validProcessingTimes = logs.filter(l => l.processingTime !== null).map(l => l.processingTime!);
    const validTokensUsed = logs.filter(l => l.tokensUsed !== null).map(l => l.tokensUsed!);
    const validPerformanceScores = logs.filter(l => l.performanceScore !== null).map(l => l.performanceScore!);
    
    const avgConfidence = validConfidences.length > 0
      ? validConfidences.reduce((a, b) => a + b, 0) / validConfidences.length
      : 0;
    
    const avgProcessingTime = validProcessingTimes.length > 0
      ? validProcessingTimes.reduce((a, b) => a + b, 0) / validProcessingTimes.length
      : 0;
    
    const avgTokensUsed = validTokensUsed.length > 0
      ? validTokensUsed.reduce((a, b) => a + b, 0) / validTokensUsed.length
      : 0;
    
    // Calculate success rate (performance score >= 0.5 is considered success)
    const successCount = validPerformanceScores.filter(s => s >= 0.5).length;
    const successRate = validPerformanceScores.length > 0
      ? successCount / validPerformanceScores.length
      : 0;
    
    metrics.push({
      agentType,
      avgConfidence,
      avgProcessingTime,
      avgTokensUsed,
      totalExecutions: logs.length,
      successRate,
    });
  }
  
  return metrics;
}

/**
 * Get summary of agent logs for an interview
 */
export async function getAgentLogsSummary(interviewId: string): Promise<{
  totalExecutions: number;
  avgConfidence: number;
  topFindings: string[];
  byAgentType: Record<string, number>;
}> {
  const logs = await getAgentLogs(interviewId);
  
  if (logs.length === 0) {
    return {
      totalExecutions: 0,
      avgConfidence: 0,
      topFindings: [],
      byAgentType: {},
    };
  }
  
  // Calculate average confidence
  const validConfidences = logs.filter(l => l.confidence !== null).map(l => l.confidence!);
  const avgConfidence = validConfidences.length > 0
    ? validConfidences.reduce((a, b) => a + b, 0) / validConfidences.length
    : 0;
  
  // Count by agent type
  const byAgentType: Record<string, number> = {};
  for (const log of logs) {
    byAgentType[log.agentType] = (byAgentType[log.agentType] || 0) + 1;
  }
  
  // Extract top findings from findings field
  const topFindings: string[] = [];
  for (const log of logs) {
    if (log.findings && typeof log.findings === 'object') {
      const findings = log.findings as Record<string, unknown>;
      if (findings.insights && Array.isArray(findings.insights)) {
        topFindings.push(...(findings.insights as string[]).slice(0, 2));
      }
      if (findings.summary && typeof findings.summary === 'string') {
        topFindings.push(findings.summary);
      }
    }
  }
  
  return {
    totalExecutions: logs.length,
    avgConfidence,
    topFindings: [...new Set(topFindings)].slice(0, 5),
    byAgentType,
  };
}

/**
 * Get the latest agent log for a response by agent type
 */
export async function getLatestAgentLog(
  responseId: string,
  agentType: AgentType
): Promise<AgentLogType | null> {
  return await prisma.agentLog.findFirst({
    where: {
      responseId,
      agentType,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete agent logs for an interview
 */
export async function deleteAgentLogs(interviewId: string): Promise<number> {
  const result = await prisma.agentLog.deleteMany({
    where: { interviewId },
  });
  
  return result.count;
}
