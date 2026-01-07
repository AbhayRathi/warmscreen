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
  const candidateId = `cand-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
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
  const updateData: any = { status };
  
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

export async function completeInterview(id: string): Promise<Interview> {
  return await prisma.interview.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
}
