/**
 * Agent Factory & Registration
 * 
 * Manages agent instantiation, registration, and pipeline creation.
 * Provides the main entry point for executing agent analysis pipelines.
 */

import { AgentType as PrismaAgentType } from '@warmscreen/database';
import { AgentOutput } from '@warmscreen/shared';

import {
  AgentTypes,
  AgentContext,
  OrchestrationPipeline,
  PipelineStage,
  getAgentRegistry,
  getOrchestratorAgent,
  createAgentExecutor,
  getAnalyzerAgent,
  getTaggerAgent,
  getVerifierAgent,
  getScorerAgent,
  getNarratorAgent,
} from './index';

import { createAgentLog, CreateAgentLogInput } from '../db/agent-log';
import { getResponseById } from '../db/response';
import { getInterviewById } from '../db/interview';
import prisma from '../db/prisma';

// ============================================================================
// Agent Registration
// ============================================================================

/**
 * Register all agent implementations with the global registry
 * @returns Number of agents registered
 */
export function registerAllAgents(): number {
  const registry = getAgentRegistry();
  const orchestrator = getOrchestratorAgent();
  
  // Get agent instances
  const analyzer = getAnalyzerAgent();
  const tagger = getTaggerAgent();
  const verifier = getVerifierAgent();
  const scorer = getScorerAgent();
  const narrator = getNarratorAgent();
  
  // Register agents with registry
  analyzer.register();
  tagger.register();
  verifier.register();
  scorer.register();
  narrator.register();
  
  // Register executors with orchestrator
  orchestrator.registerExecutor(AgentTypes.ANALYZER, createAgentExecutor(analyzer));
  orchestrator.registerExecutor(AgentTypes.TAGGER, createAgentExecutor(tagger));
  orchestrator.registerExecutor(AgentTypes.VERIFIER, createAgentExecutor(verifier));
  orchestrator.registerExecutor(AgentTypes.SCORER, createAgentExecutor(scorer));
  orchestrator.registerExecutor(AgentTypes.NARRATOR, createAgentExecutor(narrator));
  
  return registry.getAllAgents().length;
}

// ============================================================================
// Pipeline Creation
// ============================================================================

/**
 * Create an analysis pipeline for a specific position
 * 
 * Pipeline Order:
 * 1. Analyzer (required) - Deep technical analysis
 * 2. Tagger (required) - Skill extraction (can run parallel with Analyzer)
 * 3. Verifier (required) - Consistency verification (depends on Analyzer, Tagger)
 * 4. Scorer (optional) - Multi-dimensional scoring (depends on Analyzer, Tagger)
 * 5. Narrator (optional) - Human-readable explanation (depends on Scorer)
 * 
 * @param position - The position being interviewed for
 * @returns Orchestrator instance configured with the pipeline
 */
export function createAnalysisPipeline(position: string): OrchestrationPipeline {
  // Create custom pipeline stages based on position
  const stages: PipelineStage[] = [
    {
      order: 1,
      agentType: AgentTypes.ANALYZER,
      required: true,
      timeout: 15000,
      retries: 2,
    },
    {
      order: 2,
      agentType: AgentTypes.TAGGER,
      required: true,
      timeout: 10000,
      retries: 2,
    },
    {
      order: 3,
      agentType: AgentTypes.VERIFIER,
      required: true,
      timeout: 12000,
      retries: 1,
      dependsOn: [AgentTypes.ANALYZER, AgentTypes.TAGGER],
    },
    {
      order: 4,
      agentType: AgentTypes.SCORER,
      required: false,
      timeout: 10000,
      retries: 1,
      dependsOn: [AgentTypes.ANALYZER, AgentTypes.TAGGER],
    },
    {
      order: 5,
      agentType: AgentTypes.NARRATOR,
      required: false,
      timeout: 12000,
      retries: 1,
      dependsOn: [AgentTypes.SCORER],
    },
  ];
  
  // Adjust timeouts based on position complexity
  const complexPositions = ['Engineering Manager', 'Principal Engineer', 'Staff Engineer'];
  if (complexPositions.some(p => position.includes(p))) {
    stages.forEach(stage => {
      stage.timeout = Math.round(stage.timeout * 1.5);
    });
  }
  
  return {
    name: `analysis_${position.replace(/\s+/g, '_').toLowerCase()}`,
    stages,
    parallel: false, // Sequential for now, can enable parallel for independent stages
    maxTotalTime: 60000,
    onError: 'CONTINUE', // Continue with other agents if one fails
  };
}

// ============================================================================
// Full Analysis Execution
// ============================================================================

export interface FullAnalysisResult {
  analysis: Record<string, unknown>;
  agentOutputs: Map<string, AgentOutput>;
  processingTime: number;
  success: boolean;
  errors: string[];
}

/**
 * Execute full analysis pipeline for a response
 * 
 * Steps:
 * 1. Fetch response with question and interview data
 * 2. Create pipeline for the position
 * 3. Build agent context
 * 4. Execute pipeline
 * 5. Store results in AgentLog for each agent
 * 6. Update response with agentAnalysis field
 * 
 * @param interviewId - The interview ID
 * @param responseId - The response ID to analyze
 * @returns Full analysis result with all agent outputs
 */
export async function executeFullAnalysis(
  interviewId: string,
  responseId: string
): Promise<FullAnalysisResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const agentOutputs = new Map<string, AgentOutput>();
  
  try {
    // 1. Fetch response with question
    const response = await getResponseById(responseId);
    if (!response) {
      throw new Error(`Response not found: ${responseId}`);
    }
    
    // 2. Fetch interview data
    const interview = await getInterviewById(interviewId);
    if (!interview) {
      throw new Error(`Interview not found: ${interviewId}`);
    }
    
    // Ensure response belongs to interview
    if (response.interviewId !== interviewId) {
      throw new Error('Response does not belong to the specified interview');
    }
    
    // Get question data
    const question = (response as { question?: { id: string; content: string; category: string; difficulty: string; position?: string } }).question;
    if (!question) {
      throw new Error('Response does not have associated question data');
    }
    
    // 3. Ensure agents are registered
    registerAllAgents();
    
    // Note: createAnalysisPipeline is available for custom pipeline configuration,
    // but the orchestrator uses its default RESPONSE_ANALYSIS_PIPELINE.
    // Future enhancement: pass custom pipeline to orchestrator.processResponse()
    
    // 4. Build agent context
    const context: AgentContext = {
      interviewId,
      responseId,
      question: {
        id: question.id,
        content: question.content,
        category: question.category,
        difficulty: question.difficulty,
        position: question.position || interview.position,
      },
      response: {
        transcript: response.transcript,
        audioUrl: response.audioUrl || undefined,
        duration: response.duration,
      },
      position: interview.position,
      candidateName: interview.candidateName,
    };
    
    // 6. Execute agents and collect outputs
    const orchestrator = getOrchestratorAgent();
    const session = await orchestrator.processResponse(context);
    
    // 7. Store results for each agent
    const analysisResults: Record<string, unknown> = {};
    
    for (const [agentType, result] of session.results) {
      agentOutputs.set(agentType, result.output);
      analysisResults[agentType.toLowerCase()] = result.output.result;
      
      // Store in AgentLog
      try {
        const agentLogData: CreateAgentLogInput = {
          interviewId,
          responseId,
          agentType: agentType as PrismaAgentType,
          action: 'analyze',
          input: { context: { questionId: question.id, position: interview.position } },
          output: result.output.result || {},
          findings: result.output.result || undefined,
          confidence: result.output.confidence,
          processingTime: result.latencyMs,
          reflexionLoop: result.reflexionLoops,
          performanceScore: result.success ? result.output.confidence : 0,
        };
        
        await createAgentLog(agentLogData);
      } catch (logError) {
        console.error(`Failed to create agent log for ${agentType}:`, logError);
        errors.push(`Failed to log ${agentType} results`);
      }
    }
    
    // 8. Update response with agentAnalysis
    const processingTime = Date.now() - startTime;
    
    try {
      // Build update data - using Prisma-compatible types
      interface UpdateData {
        agentAnalysis: object;
        analyzedAt: Date;
        scores?: object;
        confidence?: number;
        sentiment?: number;
        tags?: string[];
      }
      
      const updateData: UpdateData = {
        agentAnalysis: analysisResults as object,
        analyzedAt: new Date(),
      };
      
      // Update scores if scorer ran
      if (analysisResults.scorer && typeof analysisResults.scorer === 'object' &&
          'componentScores' in (analysisResults.scorer as Record<string, unknown>)) {
        updateData.scores = (analysisResults.scorer as { componentScores: object }).componentScores;
      }
      
      // Update confidence if analyzer provides it
      if (analysisResults.analyzer && typeof analysisResults.analyzer === 'object' &&
          'confidence' in (analysisResults.analyzer as Record<string, unknown>)) {
        updateData.confidence = (analysisResults.analyzer as { confidence: number }).confidence;
      }
      
      // Update sentiment if tagger provides it
      if (analysisResults.tagger && typeof analysisResults.tagger === 'object' &&
          'sentiment' in (analysisResults.tagger as Record<string, unknown>)) {
        updateData.sentiment = (analysisResults.tagger as { sentiment: number }).sentiment;
      }
      
      // Update tags if tagger provides them
      if (analysisResults.tagger && typeof analysisResults.tagger === 'object' &&
          'skillTags' in (analysisResults.tagger as Record<string, unknown>)) {
        updateData.tags = (analysisResults.tagger as { skillTags: string[] }).skillTags;
      }
      
      await prisma.response.update({
        where: { id: responseId },
        data: updateData,
      });
    } catch (updateError) {
      console.error('Failed to update response with analysis:', updateError);
      errors.push('Failed to update response with analysis results');
    }
    
    return {
      analysis: analysisResults,
      agentOutputs,
      processingTime,
      success: session.status === 'COMPLETED',
      errors,
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full analysis failed:', error);
    
    return {
      analysis: {},
      agentOutputs,
      processingTime,
      success: false,
      errors: [errorMessage, ...errors],
    };
  }
}

/**
 * Execute analysis for all responses in an interview
 * 
 * @param interviewId - The interview ID
 * @returns Summary of analysis results
 */
export async function executeInterviewAnalysis(interviewId: string): Promise<{
  interviewId: string;
  totalResponses: number;
  analyzedResponses: number;
  agentExecutions: number;
  totalProcessingTime: number;
  errors: string[];
}> {
  const startTime = Date.now();
  const errors: string[] = [];
  let analyzedResponses = 0;
  let agentExecutions = 0;
  
  // Fetch interview with responses
  const interview = await getInterviewById(interviewId);
  if (!interview) {
    throw new Error(`Interview not found: ${interviewId}`);
  }
  
  const totalResponses = interview.responses.length;
  
  // Analyze each response
  for (const response of interview.responses) {
    try {
      const result = await executeFullAnalysis(interviewId, response.id);
      
      if (result.success) {
        analyzedResponses++;
      }
      
      agentExecutions += result.agentOutputs.size;
      errors.push(...result.errors);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to analyze response ${response.id}:`, error);
      errors.push(`Response ${response.id}: ${errorMessage}`);
    }
  }
  
  const totalProcessingTime = Date.now() - startTime;
  
  return {
    interviewId,
    totalResponses,
    analyzedResponses,
    agentExecutions,
    totalProcessingTime,
    errors,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if agents are registered
 */
export function areAgentsRegistered(): boolean {
  const registry = getAgentRegistry();
  return registry.getAllAgents().length > 0;
}

/**
 * Get agent health status
 */
export function getAgentHealthStatus() {
  const orchestrator = getOrchestratorAgent();
  return orchestrator.getHealthStatus();
}

/**
 * Reset all agents (for testing)
 */
export function resetAllAgents(): void {
  // Reset registry
  import('./registry').then(({ AgentRegistry }) => {
    AgentRegistry.resetInstance();
  });
  
  // Reset orchestrator
  import('./orchestrator').then(({ resetOrchestratorAgent }) => {
    resetOrchestratorAgent();
  });
  
  // Reset individual agents
  import('./analyzer-agent').then(({ resetAnalyzerAgent }) => {
    resetAnalyzerAgent();
  });
  
  import('./tagger-agent').then(({ resetTaggerAgent }) => {
    resetTaggerAgent();
  });
  
  import('./verifier-agent').then(({ resetVerifierAgent }) => {
    resetVerifierAgent();
  });
  
  import('./scorer-agent').then(({ resetScorerAgent }) => {
    resetScorerAgent();
  });
  
  import('./narrator-agent').then(({ resetNarratorAgent }) => {
    resetNarratorAgent();
  });
}
