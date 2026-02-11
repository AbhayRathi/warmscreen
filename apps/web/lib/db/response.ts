import prisma from './prisma';
import { z } from 'zod';

// Type alias for Response from Prisma
type ResponseType = Awaited<ReturnType<typeof prisma.response.findFirst>> & {};

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const CreateResponseSchema = z.object({
  interviewId: z.string().min(1, 'Interview ID is required'),
  questionId: z.string().min(1, 'Question ID is required'),
  transcript: z.string().min(1, 'Transcript is required'),
  duration: z.number().int().min(0, 'Duration must be a positive integer'),
  audioUrl: z.string().url().optional().nullable(),
});

export const UpdateResponseSchema = z.object({
  transcript: z.string().min(1).optional(),
  scores: z.record(z.string(), z.number()).optional(),
  tags: z.array(z.string()).optional(),
  sentiment: z.number().min(-1).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

// ============================================================================
// Type Definitions
// ============================================================================

export type CreateResponseInput = z.infer<typeof CreateResponseSchema>;
export type UpdateResponseInput = z.infer<typeof UpdateResponseSchema>;

export interface ResponseWithQuestion extends ResponseType {
  question: {
    id: string;
    content: string;
    category: string;
    difficulty: string;
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new response (candidate answer)
 */
export async function createResponse(
  data: CreateResponseInput
): Promise<ResponseType> {
  const validated = CreateResponseSchema.parse(data);
  
  return await prisma.response.create({
    data: {
      interviewId: validated.interviewId,
      questionId: validated.questionId,
      transcript: validated.transcript,
      duration: validated.duration,
      audioUrl: validated.audioUrl || null,
      scores: {},
      tags: [],
    },
  });
}

/**
 * Get a response by ID
 */
export async function getResponseById(id: string): Promise<ResponseType | null> {
  return await prisma.response.findUnique({
    where: { id },
    include: {
      question: true,
    },
  });
}

/**
 * Get all responses for an interview, ordered by createdAt
 */
export async function getInterviewResponses(
  interviewId: string
): Promise<ResponseWithQuestion[]> {
  const responses = await prisma.response.findMany({
    where: { interviewId },
    orderBy: { createdAt: 'asc' },
    include: {
      question: {
        select: {
          id: true,
          content: true,
          category: true,
          difficulty: true,
        },
      },
    },
  });
  
  return responses as ResponseWithQuestion[];
}

/**
 * Update a response (for score/analysis updates from PR #9)
 */
export async function updateResponse(
  id: string,
  data: UpdateResponseInput
): Promise<ResponseType> {
  const validated = UpdateResponseSchema.parse(data);
  
  return await prisma.response.update({
    where: { id },
    data: validated,
  });
}

/**
 * Get count of responses for an interview (track progress)
 */
export async function getResponseCount(interviewId: string): Promise<number> {
  return await prisma.response.count({
    where: { interviewId },
  });
}

/**
 * Get question IDs that have been answered in an interview
 */
export async function getAnsweredQuestionIds(interviewId: string): Promise<string[]> {
  const responses = await prisma.response.findMany({
    where: { interviewId },
    select: { questionId: true },
  });
  
  return responses.map((r) => r.questionId);
}

/**
 * Delete a response by ID
 */
export async function deleteResponse(id: string): Promise<ResponseType> {
  return await prisma.response.delete({
    where: { id },
  });
}
