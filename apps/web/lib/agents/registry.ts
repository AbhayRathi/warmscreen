/**
 * Agent Registry
 * 
 * Manages agent registration, discovery, and status tracking.
 * Provides centralized access to agent capabilities and metrics.
 */

import {
  AgentType,
  AgentTypes,
  AgentStatus,
  AgentRegistration,
  AgentCapability,
  AgentPerformanceMetrics,
  DEFAULT_AGENT_CAPABILITIES,
} from './types';

/**
 * Agent Registry - Singleton pattern for global agent management
 */
export class AgentRegistry {
  private static instance: AgentRegistry | null = null;
  private registrations: Map<AgentType, AgentRegistration>;
  private performanceHistory: Map<AgentType, AgentPerformanceMetrics[]>;

  private constructor() {
    this.registrations = new Map();
    this.performanceHistory = new Map();
    this.initializeDefaultAgents();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Reset instance (for testing)
   */
  static resetInstance(): void {
    AgentRegistry.instance = null;
  }

  /**
   * Initialize default agent registrations
   */
  private initializeDefaultAgents(): void {
    Object.values(AgentTypes).forEach((type) => {
      const capability = DEFAULT_AGENT_CAPABILITIES[type];
      if (capability) {
        this.register(type, capability);
      }
    });
  }

  /**
   * Register an agent with the registry
   */
  register(type: AgentType, capability: AgentCapability): void {
    const registration: AgentRegistration = {
      type,
      capability,
      status: AgentStatus.IDLE,
      executionCount: 0,
      avgLatencyMs: 0,
      avgConfidence: 0,
      errorCount: 0,
    };
    this.registrations.set(type, registration);
    this.performanceHistory.set(type, []);
  }

  /**
   * Unregister an agent
   */
  unregister(type: AgentType): boolean {
    this.performanceHistory.delete(type);
    return this.registrations.delete(type);
  }

  /**
   * Get agent registration
   */
  getAgent(type: AgentType): AgentRegistration | undefined {
    return this.registrations.get(type);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): AgentRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: AgentStatus): AgentRegistration[] {
    return this.getAllAgents().filter((agent) => agent.status === status);
  }

  /**
   * Get available agents (idle or completed)
   */
  getAvailableAgents(): AgentRegistration[] {
    return this.getAllAgents().filter(
      (agent) =>
        agent.status === AgentStatus.IDLE ||
        agent.status === AgentStatus.COMPLETED
    );
  }

  /**
   * Update agent status
   */
  updateStatus(type: AgentType, status: AgentStatus): void {
    const registration = this.registrations.get(type);
    if (registration) {
      registration.status = status;
      if (status === AgentStatus.COMPLETED || status === AgentStatus.FAILED) {
        registration.lastExecutionTime = new Date();
      }
    }
  }

  /**
   * Record execution metrics for an agent
   */
  recordExecution(
    type: AgentType,
    latencyMs: number,
    confidence: number,
    success: boolean
  ): void {
    const registration = this.registrations.get(type);
    if (registration) {
      registration.executionCount++;
      registration.lastExecutionTime = new Date();

      // Update rolling average latency
      registration.avgLatencyMs =
        (registration.avgLatencyMs * (registration.executionCount - 1) +
          latencyMs) /
        registration.executionCount;

      // Update rolling average confidence
      registration.avgConfidence =
        (registration.avgConfidence * (registration.executionCount - 1) +
          confidence) /
        registration.executionCount;

      if (!success) {
        registration.errorCount++;
      }
    }
  }

  /**
   * Get agent capability
   */
  getCapability(type: AgentType): AgentCapability | undefined {
    return this.registrations.get(type)?.capability;
  }

  /**
   * Check if agent can execute based on dependencies
   */
  canExecute(
    type: AgentType,
    completedAgents: Set<AgentType>
  ): boolean {
    const capability = this.getCapability(type);
    if (!capability) return false;

    // Check if all dependencies are satisfied
    if (capability.dependsOn) {
      return capability.dependsOn.every((dep) => completedAgents.has(dep));
    }

    return true;
  }

  /**
   * Get agents that can run in parallel
   */
  getParallelizableAgents(completedAgents: Set<AgentType>): AgentType[] {
    return Array.from(this.registrations.keys()).filter((type) => {
      const capability = this.getCapability(type);
      if (!capability) return false;

      // Can parallelize if no dependencies or all dependencies met
      if (!capability.dependsOn) return true;
      return capability.dependsOn.every((dep) => completedAgents.has(dep));
    });
  }

  /**
   * Get performance metrics for an agent
   */
  getPerformanceMetrics(
    type: AgentType
  ): AgentPerformanceMetrics | undefined {
    const registration = this.registrations.get(type);
    if (!registration) return undefined;

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    return {
      agentType: type,
      period: {
        start: hourAgo,
        end: now,
      },
      executions: registration.executionCount,
      avgLatencyMs: registration.avgLatencyMs,
      avgConfidence: registration.avgConfidence,
      successRate:
        registration.executionCount > 0
          ? (registration.executionCount - registration.errorCount) /
            registration.executionCount
          : 0,
      reflexionRate: 0, // Would need additional tracking
      errorRate:
        registration.executionCount > 0
          ? registration.errorCount / registration.executionCount
          : 0,
    };
  }

  /**
   * Get all performance metrics
   */
  getAllPerformanceMetrics(): AgentPerformanceMetrics[] {
    return Array.from(this.registrations.keys())
      .map((type) => this.getPerformanceMetrics(type))
      .filter((metrics): metrics is AgentPerformanceMetrics => metrics !== undefined);
  }

  /**
   * Get execution order for a pipeline based on dependencies
   */
  getExecutionOrder(agentTypes: AgentType[]): AgentType[][] {
    const levels: AgentType[][] = [];
    const remaining = new Set(agentTypes);
    const completed = new Set<AgentType>();

    while (remaining.size > 0) {
      const currentLevel: AgentType[] = [];

      for (const type of remaining) {
        if (this.canExecute(type, completed)) {
          currentLevel.push(type);
        }
      }

      if (currentLevel.length === 0 && remaining.size > 0) {
        // Circular dependency or missing dependency - add remaining as final level
        levels.push(Array.from(remaining));
        break;
      }

      currentLevel.forEach((type) => {
        remaining.delete(type);
        completed.add(type);
      });

      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      }
    }

    return levels;
  }

  /**
   * Check health of all agents
   */
  getHealthStatus(): {
    healthy: AgentType[];
    degraded: AgentType[];
    unhealthy: AgentType[];
  } {
    const healthy: AgentType[] = [];
    const degraded: AgentType[] = [];
    const unhealthy: AgentType[] = [];

    for (const [type, registration] of this.registrations) {
      const errorRate =
        registration.executionCount > 0
          ? registration.errorCount / registration.executionCount
          : 0;

      if (errorRate > 0.5) {
        unhealthy.push(type);
      } else if (errorRate > 0.2 || registration.avgConfidence < 0.5) {
        degraded.push(type);
      } else {
        healthy.push(type);
      }
    }

    return { healthy, degraded, unhealthy };
  }
}

/**
 * Export singleton getter for convenience
 */
export const getAgentRegistry = (): AgentRegistry => AgentRegistry.getInstance();
