/**
 * Tests for Agent Types
 */

import { describe, it, expect } from 'vitest';
import {
  AgentTypes,
  AgentStatus,
  MessagePriority,
  isAgentType,
  DEFAULT_AGENT_CAPABILITIES,
  RESPONSE_ANALYSIS_PIPELINE,
  FINALIZATION_PIPELINE,
} from '../types';

describe('AgentTypes', () => {
  it('should define all required agent types', () => {
    expect(AgentTypes.ORCHESTRATOR).toBe('ORCHESTRATOR');
    expect(AgentTypes.ANALYZER).toBe('ANALYZER');
    expect(AgentTypes.VERIFIER).toBe('VERIFIER');
    expect(AgentTypes.TAGGER).toBe('TAGGER');
    expect(AgentTypes.SCORER).toBe('SCORER');
    expect(AgentTypes.NARRATOR).toBe('NARRATOR');
    expect(AgentTypes.PLANNER).toBe('PLANNER');
    expect(AgentTypes.CONDUCTOR).toBe('CONDUCTOR');
  });

  it('should have 8 agent types', () => {
    const types = Object.values(AgentTypes);
    expect(types.length).toBe(8);
  });
});

describe('AgentStatus', () => {
  it('should define all required status values', () => {
    expect(AgentStatus.IDLE).toBe('IDLE');
    expect(AgentStatus.RUNNING).toBe('RUNNING');
    expect(AgentStatus.COMPLETED).toBe('COMPLETED');
    expect(AgentStatus.FAILED).toBe('FAILED');
    expect(AgentStatus.WAITING).toBe('WAITING');
  });
});

describe('MessagePriority', () => {
  it('should define priority levels in order', () => {
    expect(MessagePriority.LOW).toBe(0);
    expect(MessagePriority.NORMAL).toBe(1);
    expect(MessagePriority.HIGH).toBe(2);
    expect(MessagePriority.CRITICAL).toBe(3);
  });

  it('should allow numeric comparison', () => {
    expect(MessagePriority.CRITICAL > MessagePriority.HIGH).toBe(true);
    expect(MessagePriority.HIGH > MessagePriority.NORMAL).toBe(true);
    expect(MessagePriority.NORMAL > MessagePriority.LOW).toBe(true);
  });
});

describe('isAgentType', () => {
  it('should return true for valid agent types', () => {
    expect(isAgentType('ORCHESTRATOR')).toBe(true);
    expect(isAgentType('ANALYZER')).toBe(true);
    expect(isAgentType('VERIFIER')).toBe(true);
    expect(isAgentType('TAGGER')).toBe(true);
    expect(isAgentType('SCORER')).toBe(true);
    expect(isAgentType('NARRATOR')).toBe(true);
  });

  it('should return false for invalid agent types', () => {
    expect(isAgentType('INVALID')).toBe(false);
    expect(isAgentType('')).toBe(false);
    expect(isAgentType('orchestrator')).toBe(false); // case sensitive
  });
});

describe('DEFAULT_AGENT_CAPABILITIES', () => {
  it('should define capabilities for all agent types', () => {
    for (const type of Object.values(AgentTypes)) {
      expect(DEFAULT_AGENT_CAPABILITIES[type]).toBeDefined();
      expect(DEFAULT_AGENT_CAPABILITIES[type].type).toBe(type);
    }
  });

  it('should have valid capability structure', () => {
    const analyzerCap = DEFAULT_AGENT_CAPABILITIES[AgentTypes.ANALYZER];
    expect(analyzerCap.description).toBeTruthy();
    expect(Array.isArray(analyzerCap.inputTypes)).toBe(true);
    expect(Array.isArray(analyzerCap.outputTypes)).toBe(true);
    expect(typeof analyzerCap.maxConcurrency).toBe('number');
    expect(typeof analyzerCap.reflexionEnabled).toBe('boolean');
  });

  it('should define correct dependencies', () => {
    const verifierCap = DEFAULT_AGENT_CAPABILITIES[AgentTypes.VERIFIER];
    expect(verifierCap.dependsOn).toContain(AgentTypes.ANALYZER);
    expect(verifierCap.dependsOn).toContain(AgentTypes.TAGGER);

    const narratorCap = DEFAULT_AGENT_CAPABILITIES[AgentTypes.NARRATOR];
    expect(narratorCap.dependsOn).toContain(AgentTypes.SCORER);
  });

  it('should not have reflexion enabled for orchestrator', () => {
    expect(DEFAULT_AGENT_CAPABILITIES[AgentTypes.ORCHESTRATOR].reflexionEnabled).toBe(false);
  });
});

describe('RESPONSE_ANALYSIS_PIPELINE', () => {
  it('should have correct pipeline name', () => {
    expect(RESPONSE_ANALYSIS_PIPELINE.name).toBe('response_analysis');
  });

  it('should have stages in correct order', () => {
    const stages = RESPONSE_ANALYSIS_PIPELINE.stages;
    expect(stages[0].agentType).toBe(AgentTypes.ANALYZER);
    expect(stages[1].agentType).toBe(AgentTypes.TAGGER);
    expect(stages[2].agentType).toBe(AgentTypes.VERIFIER);
    expect(stages[3].agentType).toBe(AgentTypes.SCORER);
  });

  it('should mark analyzer and tagger as required', () => {
    const stages = RESPONSE_ANALYSIS_PIPELINE.stages;
    expect(stages[0].required).toBe(true); // Analyzer
    expect(stages[1].required).toBe(true); // Tagger
    expect(stages[2].required).toBe(true); // Verifier
    expect(stages[3].required).toBe(false); // Scorer
  });

  it('should define verifier dependencies', () => {
    const verifierStage = RESPONSE_ANALYSIS_PIPELINE.stages.find(
      (s) => s.agentType === AgentTypes.VERIFIER
    );
    expect(verifierStage?.dependsOn).toContain(AgentTypes.ANALYZER);
    expect(verifierStage?.dependsOn).toContain(AgentTypes.TAGGER);
  });
});

describe('FINALIZATION_PIPELINE', () => {
  it('should have correct pipeline name', () => {
    expect(FINALIZATION_PIPELINE.name).toBe('interview_finalization');
  });

  it('should start with scorer', () => {
    expect(FINALIZATION_PIPELINE.stages[0].agentType).toBe(AgentTypes.SCORER);
  });

  it('should include narrator with scorer dependency', () => {
    const narratorStage = FINALIZATION_PIPELINE.stages.find(
      (s) => s.agentType === AgentTypes.NARRATOR
    );
    expect(narratorStage).toBeDefined();
    expect(narratorStage?.dependsOn).toContain(AgentTypes.SCORER);
  });

  it('should stop on error', () => {
    expect(FINALIZATION_PIPELINE.onError).toBe('STOP');
  });
});
