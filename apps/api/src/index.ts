import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import env from '@fastify/env';
import * as Sentry from '@sentry/node';
import { PrismaClient } from '@warmscreen/database';
import { interviewRoutes } from './routes/interviews';
import { questionRoutes } from './routes/questions';
import { agentRoutes } from './routes/agents';
import { voiceRoutes } from './routes/voice';
import { proctoringRoutes } from './routes/proctoring';
import { createRedisClient, disconnectRedis, connectRedis } from './lib/redis';
import { initCache } from './lib/cache';
import { API_INFO } from './lib/api-info';

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    PORT: { type: 'number', default: 3001 },
    DATABASE_URL: { type: 'string' },
    REDIS_URL: { type: 'string' },
    SENTRY_DSN: { type: 'string' },
    LIVEKIT_URL: { type: 'string' },
    LIVEKIT_API_KEY: { type: 'string' },
    LIVEKIT_API_SECRET: { type: 'string' },
    DEEPGRAM_API_KEY: { type: 'string' },
    ELEVENLABS_API_KEY: { type: 'string' },
    INTERVIEWER_VOICE_ID: { type: 'string' },
    LIVEKIT_AGENT_ID: { type: 'string' },
    LIVEKIT_PROJECT_ID: { type: 'string' },
    DEFAULT_RECRUITER_ID: { type: 'string', default: 'default-recruiter' },
    AGI_API_KEY: { type: 'string' },
    AGI_API_BASE_URL: { type: 'string', default: 'https://api.agi.run/v1' },
  },
};

async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Load environment variables
  await server.register(env, {
    schema: envSchema,
    dotenv: true,
  });

  // Initialize Sentry
  if (server.config.SENTRY_DSN) {
    Sentry.init({
      dsn: server.config.SENTRY_DSN,
      tracesSampleRate: 1.0,
      environment: process.env.NODE_ENV || 'development',
    });
    
    server.addHook('onRequest', (request, reply, done) => {
      Sentry.setContext('request', {
        method: request.method,
        url: request.url,
      });
      done();
    });

    server.addHook('onError', (request, reply, error, done) => {
      Sentry.captureException(error);
      done();
    });
  }

  // Initialize Prisma
  const prisma = new PrismaClient();
  server.decorate('prisma', prisma);

  // Initialize Redis (optional)
  const redis = createRedisClient({
    url: server.config.REDIS_URL,
    logger: server.log,
  });

  // Decorate with proper typing for nullable redis
  server.decorate('redis', redis as any);
  initCache(server.log);

  // Connect to Redis if configured
  if (redis) {
    await connectRedis(server.log);
  }

  // Register plugins
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  await server.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  await server.register(websocket);

  // Root route
  server.get('/', async () => {
    return API_INFO;
  });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await server.register(interviewRoutes, { prefix: '/api/interviews' });
  await server.register(questionRoutes, { prefix: '/api/questions' });
  await server.register(agentRoutes, { prefix: '/api/agents' });
  await server.register(voiceRoutes, { prefix: '/api/voice' });
  await server.register(proctoringRoutes, { prefix: '/api/proctoring' });

  // Graceful shutdown
  const closeGracefully = async (signal: string) => {
    console.log(`Received ${signal}, closing gracefully`);
    await server.close();
    await disconnectRedis(server.log);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => closeGracefully('SIGINT'));
  process.on('SIGTERM', () => closeGracefully('SIGTERM'));

  return server;
}

async function start() {
  try {
    const server = await buildServer();
    const port = server.config.PORT || 3001;
    
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 API server running on http://localhost:${port}`);
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${err.port} is already in use. Please free up the port and try again.`);
      console.error(`   Run: fuser -k ${err.port}/tcp`);
    } else {
      console.error('Error starting server:', err);
    }
    process.exit(1);
  }
}

start();
