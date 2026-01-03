import { AgentInput, AgentOutput, AgentType } from '@warmscreen/shared';

export abstract class BaseAgent {
  protected type: AgentType;
  protected maxReflexionLoops: number = 3;

  constructor(type: AgentType) {
    this.type = type;
  }

  // Accept AgentInput or any duck-typed compatible input
  abstract execute(input: AgentInput | Record<string, any>): Promise<AgentOutput>;

  protected async reflect(output: AgentOutput, input: AgentInput): Promise<AgentOutput> {
    // Base reflexion logic - subclasses can override
    if (output.reflexionLoop >= this.maxReflexionLoops) {
      return { ...output, shouldReflect: false };
    }

    if (output.confidence < 0.7) {
      // Trigger reflexion
      return this.execute({
        ...input,
        previousOutput: output,
        reflexionLoop: (input.reflexionLoop || 0) + 1,
      });
    }

    return output;
  }

  protected createOutput(
    result: any,
    confidence: number,
    metadata?: any,
    reflexionLoop: number = 0
  ): AgentOutput {
    return {
      type: this.type,
      result,
      confidence,
      metadata,
      shouldReflect: confidence < 0.7,
      reflexionLoop,
    };
  }
}
