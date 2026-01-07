import prisma from './prisma';
import { User } from '@warmscreen/database';

export interface CreateUserInput {
  email: string;
  name: string;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

export async function createUser(data: CreateUserInput): Promise<User> {
  return await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name,
    },
  });
}

export async function findOrCreateUser(data: CreateUserInput): Promise<User> {
  const existingUser = await findUserByEmail(data.email);
  
  if (existingUser) {
    return existingUser;
  }
  
  return await createUser(data);
}

export async function getUserById(id: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: { id },
  });
}
