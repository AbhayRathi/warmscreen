/**
 * Agent Communication Channel
 * 
 * Provides inter-agent communication through message passing.
 * Supports priority-based message handling and audit logging.
 */

import {
  AgentType,
  AgentTypes,
  AgentMessage,
  AgentChannel,
  MessagePriority,
  AgentContext,
} from './types';
import { AgentOutput } from '@warmscreen/shared';

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a correlation ID for tracking related messages
 */
function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Agent Communication Manager
 * 
 * Manages message routing between agents with priority queuing and logging.
 */
export class AgentCommunicationManager {
  private channels: Map<string, AgentChannelImpl>;
  private messageLog: AgentMessage[];
  private readonly maxLogSize: number;
  private subscribers: Map<AgentType, ((message: AgentMessage) => void)[]>;

  constructor(maxLogSize: number = 1000) {
    this.channels = new Map();
    this.messageLog = [];
    this.maxLogSize = maxLogSize;
    this.subscribers = new Map();
    this.initializeDefaultChannels();
  }

  /**
   * Initialize default communication channels
   */
  private initializeDefaultChannels(): void {
    // Main orchestration channel
    this.createChannel('orchestration', [
      AgentTypes.ORCHESTRATOR,
      AgentTypes.ANALYZER,
      AgentTypes.VERIFIER,
      AgentTypes.TAGGER,
      AgentTypes.SCORER,
      AgentTypes.NARRATOR,
    ]);

    // Analysis channel for collaborative analysis
    this.createChannel('analysis', [
      AgentTypes.ANALYZER,
      AgentTypes.VERIFIER,
      AgentTypes.TAGGER,
    ]);

    // Scoring channel
    this.createChannel('scoring', [
      AgentTypes.SCORER,
      AgentTypes.NARRATOR,
      AgentTypes.VERIFIER,
    ]);
  }

  /**
   * Create a new communication channel
   */
  createChannel(
    name: string,
    agents: AgentType[],
    maxQueueSize: number = 100,
    processingOrder: 'FIFO' | 'PRIORITY' = 'PRIORITY'
  ): AgentChannelImpl {
    const channel = new AgentChannelImpl(name, agents, maxQueueSize, processingOrder);
    this.channels.set(name, channel);
    return channel;
  }

  /**
   * Get a channel by name
   */
  getChannel(name: string): AgentChannelImpl | undefined {
    return this.channels.get(name);
  }

  /**
   * Subscribe to messages for an agent
   */
  subscribe(agentType: AgentType, handler: (message: AgentMessage) => void): void {
    if (!this.subscribers.has(agentType)) {
      this.subscribers.set(agentType, []);
    }
    this.subscribers.get(agentType)!.push(handler);
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(agentType: AgentType, handler: (message: AgentMessage) => void): void {
    const handlers = this.subscribers.get(agentType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Send a message between agents
   */
  send(
    fromAgent: AgentType,
    toAgent: AgentType,
    payload: AgentMessage['payload'],
    priority: MessagePriority = MessagePriority.NORMAL,
    correlationId?: string
  ): AgentMessage {
    const message: AgentMessage = {
      id: generateMessageId(),
      fromAgent,
      toAgent,
      priority,
      payload,
      timestamp: new Date(),
      correlationId: correlationId || generateCorrelationId(),
    };

    // Log the message
    this.logMessage(message);

    // Route to appropriate channel(s)
    for (const channel of Array.from(this.channels.values())) {
      if (channel.hasAgent(fromAgent) && channel.hasAgent(toAgent)) {
        channel.enqueue(message);
      }
    }

    // Notify subscribers
    this.notifySubscribers(toAgent, message);

    return message;
  }

  /**
   * Send a request and create a reply-to reference
   */
  sendRequest(
    fromAgent: AgentType,
    toAgent: AgentType,
    context: AgentContext,
    priority: MessagePriority = MessagePriority.NORMAL
  ): AgentMessage {
    const message = this.send(
      fromAgent,
      toAgent,
      {
        type: 'REQUEST',
        context,
      },
      priority
    );

    return message;
  }

  /**
   * Send a response to a request
   */
  sendResponse(
    fromAgent: AgentType,
    toAgent: AgentType,
    data: AgentOutput,
    replyTo: string,
    correlationId: string
  ): AgentMessage {
    const message: AgentMessage = {
      id: generateMessageId(),
      fromAgent,
      toAgent,
      priority: MessagePriority.HIGH,
      payload: {
        type: 'RESPONSE',
        data,
      },
      timestamp: new Date(),
      correlationId,
      replyTo,
    };

    this.logMessage(message);

    for (const channel of Array.from(this.channels.values())) {
      if (channel.hasAgent(fromAgent) && channel.hasAgent(toAgent)) {
        channel.enqueue(message);
      }
    }

    this.notifySubscribers(toAgent, message);

    return message;
  }

  /**
   * Send an error message
   */
  sendError(
    fromAgent: AgentType,
    toAgent: AgentType,
    error: string,
    correlationId: string
  ): AgentMessage {
    return this.send(
      fromAgent,
      toAgent,
      {
        type: 'ERROR',
        error,
      },
      MessagePriority.CRITICAL,
      correlationId
    );
  }

  /**
   * Broadcast a notification to all agents in a channel
   */
  broadcast(
    channelName: string,
    fromAgent: AgentType,
    data: Record<string, unknown>
  ): AgentMessage[] {
    const channel = this.channels.get(channelName);
    if (!channel) return [];

    const messages: AgentMessage[] = [];
    for (const agentType of channel.getAgents()) {
      if (agentType !== fromAgent) {
        const message = this.send(
          fromAgent,
          agentType,
          {
            type: 'NOTIFICATION',
            data,
          },
          MessagePriority.LOW
        );
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Get messages by correlation ID
   */
  getMessagesByCorrelationId(correlationId: string): AgentMessage[] {
    return this.messageLog.filter((msg) => msg.correlationId === correlationId);
  }

  /**
   * Get messages for a specific agent
   */
  getMessagesForAgent(agentType: AgentType): AgentMessage[] {
    return this.messageLog.filter(
      (msg) => msg.toAgent === agentType || msg.fromAgent === agentType
    );
  }

  /**
   * Get recent messages
   */
  getRecentMessages(limit: number = 100): AgentMessage[] {
    return this.messageLog.slice(-limit);
  }

  /**
   * Clear message log (for testing or maintenance)
   */
  clearLog(): void {
    this.messageLog = [];
  }

  /**
   * Log a message with size management
   */
  private logMessage(message: AgentMessage): void {
    this.messageLog.push(message);

    // Trim log if it exceeds max size
    if (this.messageLog.length > this.maxLogSize) {
      this.messageLog = this.messageLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Notify subscribers of a new message
   */
  private notifySubscribers(agentType: AgentType, message: AgentMessage): void {
    const handlers = this.subscribers.get(agentType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message);
        } catch (error) {
          console.error(
            `[AgentCommunication] Error in subscriber handler for ${agentType}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Get channel statistics
   */
  getChannelStats(): Record<string, { queueSize: number; agents: AgentType[] }> {
    const stats: Record<string, { queueSize: number; agents: AgentType[] }> = {};

    for (const [name, channel] of Array.from(this.channels.entries())) {
      stats[name] = {
        queueSize: channel.getQueueSize(),
        agents: channel.getAgents(),
      };
    }

    return stats;
  }
}

/**
 * Implementation of AgentChannel
 */
class AgentChannelImpl implements AgentChannel {
  name: string;
  agents: AgentType[];
  messageQueue: AgentMessage[];
  maxQueueSize: number;
  processingOrder: 'FIFO' | 'PRIORITY';

  constructor(
    name: string,
    agents: AgentType[],
    maxQueueSize: number,
    processingOrder: 'FIFO' | 'PRIORITY'
  ) {
    this.name = name;
    this.agents = agents;
    this.messageQueue = [];
    this.maxQueueSize = maxQueueSize;
    this.processingOrder = processingOrder;
  }

  /**
   * Check if agent is part of this channel
   */
  hasAgent(agentType: AgentType): boolean {
    return this.agents.includes(agentType);
  }

  /**
   * Get all agents in channel
   */
  getAgents(): AgentType[] {
    return [...this.agents];
  }

  /**
   * Enqueue a message
   */
  enqueue(message: AgentMessage): boolean {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Remove oldest low-priority message if queue is full
      const lowPriorityIndex = this.messageQueue.findIndex(
        (m) => m.priority === MessagePriority.LOW
      );
      if (lowPriorityIndex !== -1) {
        this.messageQueue.splice(lowPriorityIndex, 1);
      } else {
        return false; // Queue is full of high-priority messages
      }
    }

    this.messageQueue.push(message);

    if (this.processingOrder === 'PRIORITY') {
      this.messageQueue.sort((a, b) => b.priority - a.priority);
    }

    return true;
  }

  /**
   * Dequeue next message
   */
  dequeue(): AgentMessage | undefined {
    return this.messageQueue.shift();
  }

  /**
   * Peek at next message without removing
   */
  peek(): AgentMessage | undefined {
    return this.messageQueue[0];
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.messageQueue = [];
  }

  /**
   * Get messages for a specific agent
   */
  getMessagesFor(agentType: AgentType): AgentMessage[] {
    return this.messageQueue.filter((msg) => msg.toAgent === agentType);
  }
}

/**
 * Singleton communication manager
 */
let communicationManagerInstance: AgentCommunicationManager | null = null;

/**
 * Get the global communication manager instance
 */
export function getAgentCommunicationManager(): AgentCommunicationManager {
  if (!communicationManagerInstance) {
    communicationManagerInstance = new AgentCommunicationManager();
  }
  return communicationManagerInstance;
}

/**
 * Reset the communication manager (for testing)
 */
export function resetAgentCommunicationManager(): void {
  communicationManagerInstance = null;
}
