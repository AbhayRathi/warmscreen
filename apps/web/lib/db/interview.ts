import prisma from './prisma';
import { Interview, Response, InterviewStatus } from '@warmscreen/database';

export interface CreateInterviewInput {
  recruiterId: string;
  candidateName: string;
  candidateEmail: string;
  position: string;
  scheduledAt?: Date;
}

export interface InterviewWithResponses extends Interview {
  responses: Response[];
}

export async function createInterview(data: CreateInterviewInput): Promise<Interview> {
  // Generate a unique candidate ID
  const candidateId = `cand-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  
  return await prisma.interview.create({
    data: {
      recruiterId: data.recruiterId,
      candidateId,
      candidateName: data.candidateName,
      candidateEmail: data.candidateEmail.toLowerCase(),
      position: data.position,
      status: 'SCHEDULED',
      scheduledAt: data.scheduledAt || new Date(),
    },
  });
}

export async function getInterviewById(id: string): Promise<InterviewWithResponses | null> {
  return await prisma.interview.findUnique({
    where: { id },
    include: {
      responses: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function getUserInterviews(userId: string): Promise<Interview[]> {
  return await prisma.interview.findMany({
    where: { recruiterId: userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateInterviewStatus(
  id: string,
  status: InterviewStatus
): Promise<Interview> {
  interface UpdateData {
    status: InterviewStatus;
    completedAt?: Date;
    startedAt?: Date;
  }
  
  const updateData: UpdateData = { status };
  
  // If completing the interview, set completedAt
  if (status === 'COMPLETED') {
    updateData.completedAt = new Date();
  }
  
  // If starting the interview, set startedAt
  if (status === 'IN_PROGRESS') {
    updateData.startedAt = new Date();
  }
  
  return await prisma.interview.update({
    where: { id },
    data: updateData,
  });
}

export async function completeInterview(id: string, finalScore?: number): Promise<Interview> {
  return await prisma.interview.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      ...(finalScore !== undefined && { score: finalScore }),
    },
  });
}

/**
 * Start an interview - update status to IN_PROGRESS and set startedAt
 */
export async function startInterview(id: string): Promise<Interview> {
  return await prisma.interview.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  });
}

/**
 * Get interview with questions and responses included
 */
export interface InterviewWithQuestionsAndResponses extends Interview {
  responses: Array<{
    id: string;
    interviewId: string;
    questionId: string;
    transcript: string;
    duration: number;
    audioUrl: string | null;
    scores: any;
    tags: string[];
    sentiment: number | null;
    confidence: number | null;
    createdAt: Date;
    question: {
      id: string;
      content: string;
      category: string;
      difficulty: string;
      position: string;
    };
  }>;
}

export async function getInterviewWithQuestions(
  id: string
): Promise<InterviewWithQuestionsAndResponses | null> {
  return await prisma.interview.findUnique({
    where: { id },
    include: {
      responses: {
        orderBy: { createdAt: 'asc' },
        include: {
          question: {
            select: {
              id: true,
              content: true,
              category: true,
              difficulty: true,
              position: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Get interview by candidate ID (for candidate access)
 */
export async function getInterviewByCandidateId(
  candidateId: string
): Promise<InterviewWithResponses | null> {
  return await prisma.interview.findFirst({
    where: { candidateId },
    include: {
      responses: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

/**
 * Get interview by candidate ID with questions included
 */
export async function getInterviewByCandidateIdWithQuestions(
  candidateId: string
): Promise<InterviewWithQuestionsAndResponses | null> {
  return await prisma.interview.findFirst({
    where: { candidateId },
    include: {
      responses: {
        orderBy: { createdAt: 'asc' },
        include: {
          question: {
            select: {
              id: true,
              content: true,
              category: true,
              difficulty: true,
              position: true,
            },
          },
        },
      },
    },
  });
}
