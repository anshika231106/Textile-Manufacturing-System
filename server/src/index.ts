import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';

const server = createApp().listen(env.PORT, () => console.log(`API listening on port ${env.PORT}`));

// Graceful shutdown: stop accepting requests, then release DB connections.
const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
