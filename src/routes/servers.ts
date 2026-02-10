import { FastifyInstance } from 'fastify';
import { serverManager } from '../services/mc-server/ServerManager.js';
import { coreDownloader } from '../services/mc-server/CoreDownloader.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const createServerSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(['vanilla', 'paper', 'spigot', 'forge', 'fabric']),
  version: z.string(),
  port: z.number().min(1024).max(65535).optional(),
  maxMemory: z.string().optional()
});

const commandSchema = z.object({
  command: z.string().min(1)
});

export async function serverRoutes(app: FastifyInstance) {
  app.get('/types', async () => {
    return ['vanilla', 'paper', 'spigot', 'forge', 'fabric'];
  });

  app.get('/versions/:type', async (request, reply) => {
    const { type } = request.params as { type: string };
    try {
      const versions = await coreDownloader.getAvailableVersions(type as any);
      return versions;
    } catch {
      return reply.status(500).send({ error: 'Failed to fetch versions' });
    }
  });

  app.get('/', { preHandler: authMiddleware }, async () => {
    return serverManager.getAllServers().map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      version: s.version,
      port: s.port,
      status: s.status,
      createdAt: s.createdAt
    }));
  });

  app.post('/', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const body = createServerSchema.parse(request.body);
    
    try {
      const server = await serverManager.createServer(body);
      
      await coreDownloader.downloadCore(
        server.type,
        server.version,
        server.path,
        (percent) => app.log.info({ percent }, `Downloading ${server.name}`)
      );

      return reply.status(201).send({
        id: server.id,
        name: server.name,
        type: server.type,
        version: server.version,
        port: server.port,
        status: server.status
      });
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.get('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = serverManager.getServer(id);
    
    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    return {
      id: server.id,
      name: server.name,
      type: server.type,
      version: server.version,
      port: server.port,
      maxMemory: server.maxMemory,
      status: server.status,
      createdAt: server.createdAt
    };
  });

  app.post('/:id/start', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      await serverManager.startServer(id);
      return { status: 'starting' };
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.post('/:id/stop', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      await serverManager.stopServer(id);
      return { status: 'stopped' };
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.post('/:id/restart', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      await serverManager.restartServer(id);
      return { status: 'restarting' };
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.post('/:id/command', { preHandler: [authMiddleware, requireRole('moderator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = commandSchema.parse(request.body);
    
    try {
      await serverManager.sendCommand(id, body.command);
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.delete('/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      await serverManager.deleteServer(id);
      return reply.status(204).send();
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });
}
