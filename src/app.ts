import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { authRoutes } from './routes/auth.js';
import { serverRoutes } from './routes/servers.js';
import { fileRoutes } from './routes/files.js';
import { pluginRoutes } from './routes/plugins.js';
import { aiRoutes } from './routes/ai.js';
import { monitorRoutes } from './routes/monitor.js';
import { backupRoutes } from './routes/backup.js';
import { authService } from './services/auth.js';
import { serverManager } from './services/mc-server/ServerManager.js';
import { backupService } from './services/BackupService.js';
import { wsHandler } from './websocket/handler.js';
import { logger } from './utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

export async function buildApp() {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await app.register(jwt, {
    secret: JWT_SECRET
  });

  await app.register(websocket);

  authService.init(app);
  await serverManager.init();
  await backupService.init();

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(serverRoutes, { prefix: '/api/servers' });
  app.register(fileRoutes, { prefix: '/api/servers' });
  app.register(pluginRoutes, { prefix: '/api/servers' });
  app.register(monitorRoutes, { prefix: '/api/servers' });
  app.register(backupRoutes, { prefix: '/api/servers' });
  app.register(aiRoutes, { prefix: '/api/ai' });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ws', { websocket: true }, (connection: any, req) => {
    wsHandler.handleConnection(connection.socket, req);
  });

  return app;
}
