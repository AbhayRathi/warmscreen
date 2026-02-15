/**
 * Tests for Agent Communication System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentCommunicationManager,
  getAgentCommunicationManager,
  resetAgentCommunicationManager,
} from '../communication';
import { AgentTypes, MessagePriority, AgentContext } from '../types';

describe('AgentCommunicationManager', () => {
  let manager: AgentCommunicationManager;

  beforeEach(() => {
    resetAgentCommunicationManager();
    manager = getAgentCommunicationManager();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getAgentCommunicationManager();
      const instance2 = getAgentCommunicationManager();
      expect(instance1).toBe(instance2);
    });

    it('should reset properly', () => {
      const instance1 = getAgentCommunicationManager();
      resetAgentCommunicationManager();
      const instance2 = getAgentCommunicationManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Channel Management', () => {
    it('should have default channels', () => {
      const orchestration = manager.getChannel('orchestration');
      const analysis = manager.getChannel('analysis');
      const scoring = manager.getChannel('scoring');

      expect(orchestration).toBeDefined();
      expect(analysis).toBeDefined();
      expect(scoring).toBeDefined();
    });

    it('should create a custom channel', () => {
      const channel = manager.createChannel('custom', [
        AgentTypes.ANALYZER,
        AgentTypes.TAGGER,
      ]);

      expect(channel).toBeDefined();
      expect(manager.getChannel('custom')).toBeDefined();
    });

    it('should get channel statistics', () => {
      const stats = manager.getChannelStats();

      expect(stats['orchestration']).toBeDefined();
      expect(stats['orchestration'].agents).toContain(AgentTypes.ORCHESTRATOR);
    });
  });

  describe('Message Sending', () => {
    it('should send a message between agents', () => {
      const message = manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST', data: { test: true } },
        MessagePriority.NORMAL
      );

      expect(message).toBeDefined();
      expect(message.id).toBeTruthy();
      expect(message.fromAgent).toBe(AgentTypes.ORCHESTRATOR);
      expect(message.toAgent).toBe(AgentTypes.ANALYZER);
      expect(message.priority).toBe(MessagePriority.NORMAL);
      expect(message.correlationId).toBeTruthy();
    });

    it('should generate unique message IDs', () => {
      const msg1 = manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.NORMAL
      );
      const msg2 = manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.NORMAL
      );

      expect(msg1.id).not.toBe(msg2.id);
    });

    it('should use provided correlation ID', () => {
      const correlationId = 'test-correlation-123';
      const message = manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.NORMAL,
        correlationId
      );

      expect(message.correlationId).toBe(correlationId);
    });
  });

  describe('Request/Response', () => {
    it('should send a request with context', () => {
      const context: AgentContext = {
        interviewId: 'int-123',
        responseId: 'resp-456',
        question: {
          id: 'q-789',
          content: 'Test question',
          category: 'technical',
          difficulty: 'MEDIUM',
          position: 'Engineer',
        },
        response: {
          transcript: 'Test transcript',
          duration: 120,
        },
        position: 'Engineer',
      };

      const message = manager.sendRequest(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        context,
        MessagePriority.HIGH
      );

      expect(message.payload.type).toBe('REQUEST');
      expect(message.payload.context).toBe(context);
      expect(message.priority).toBe(MessagePriority.HIGH);
    });

    it('should send a response with replyTo', () => {
      const requestMessage = manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.HIGH
      );

      const response = manager.sendResponse(
        AgentTypes.ANALYZER,
        AgentTypes.ORCHESTRATOR,
        {
          type: AgentTypes.ANALYZER,
          result: { analyzed: true },
          confidence: 0.85,
          reflexionLoop: 0,
        },
        requestMessage.id,
        requestMessage.correlationId
      );

      expect(response.payload.type).toBe('RESPONSE');
      expect(response.replyTo).toBe(requestMessage.id);
      expect(response.correlationId).toBe(requestMessage.correlationId);
    });
  });

  describe('Error Messages', () => {
    it('should send an error message with critical priority', () => {
      const message = manager.sendError(
        AgentTypes.ANALYZER,
        AgentTypes.ORCHESTRATOR,
        'Processing failed',
        'corr-123'
      );

      expect(message.payload.type).toBe('ERROR');
      expect(message.payload.error).toBe('Processing failed');
      expect(message.priority).toBe(MessagePriority.CRITICAL);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all agents in channel except sender', () => {
      const messages = manager.broadcast(
        'analysis',
        AgentTypes.ANALYZER,
        { notification: 'test' }
      );

      // Should send to Verifier and Tagger (analysis channel members except Analyzer)
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.every((m) => m.fromAgent === AgentTypes.ANALYZER)).toBe(true);
      expect(messages.every((m) => m.toAgent !== AgentTypes.ANALYZER)).toBe(true);
    });

    it('should return empty array for non-existent channel', () => {
      const messages = manager.broadcast(
        'non-existent',
        AgentTypes.ANALYZER,
        { notification: 'test' }
      );

      expect(messages).toEqual([]);
    });
  });

  describe('Message Subscriptions', () => {
    it('should notify subscribers on message', () => {
      const handler = vi.fn();
      manager.subscribe(AgentTypes.ANALYZER, handler);

      manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.NORMAL
      );

      expect(handler).toHaveBeenCalled();
    });

    it('should unsubscribe handler', () => {
      const handler = vi.fn();
      manager.subscribe(AgentTypes.ANALYZER, handler);
      manager.unsubscribe(AgentTypes.ANALYZER, handler);

      manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.NORMAL
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle subscriber errors gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      manager.subscribe(AgentTypes.ANALYZER, errorHandler);

      // Should not throw
      expect(() => {
        manager.send(
          AgentTypes.ORCHESTRATOR,
          AgentTypes.ANALYZER,
          { type: 'REQUEST' },
          MessagePriority.NORMAL
        );
      }).not.toThrow();
    });
  });

  describe('Message Log', () => {
    it('should log sent messages', () => {
      manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.NORMAL
      );

      const messages = manager.getRecentMessages();
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should get messages by correlation ID', () => {
      const correlationId = 'test-corr-456';

      manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.NORMAL,
        correlationId
      );

      manager.sendResponse(
        AgentTypes.ANALYZER,
        AgentTypes.ORCHESTRATOR,
        {
          type: AgentTypes.ANALYZER,
          result: {},
          confidence: 0.8,
          reflexionLoop: 0,
        },
        'msg-123',
        correlationId
      );

      const messages = manager.getMessagesByCorrelationId(correlationId);
      expect(messages.length).toBe(2);
    });

    it('should get messages for agent', () => {
      manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.NORMAL
      );

      const messages = manager.getMessagesForAgent(AgentTypes.ANALYZER);
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should clear log', () => {
      manager.send(
        AgentTypes.ORCHESTRATOR,
        AgentTypes.ANALYZER,
        { type: 'REQUEST' },
        MessagePriority.NORMAL
      );

      manager.clearLog();
      const messages = manager.getRecentMessages();
      expect(messages.length).toBe(0);
    });

    it('should limit log size', () => {
      const smallManager = new AgentCommunicationManager(5);

      for (let i = 0; i < 10; i++) {
        smallManager.send(
          AgentTypes.ORCHESTRATOR,
          AgentTypes.ANALYZER,
          { type: 'REQUEST', data: { index: i } },
          MessagePriority.NORMAL
        );
      }

      const messages = smallManager.getRecentMessages();
      expect(messages.length).toBe(5);
    });
  });
});
