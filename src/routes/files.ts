import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import { serverManager } from '../services/mc-server/ServerManager.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: Date;
}

export async function fileRoutes(app: FastifyInstance) {
  app.get('/:id/files', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { path?: string };
    const server = serverManager.getServer(id);
    
    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    const basePath = server.path;
    const targetPath = query.path ? path.join(basePath, query.path) : basePath;
    
    if (!targetPath.startsWith(basePath)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const files: FileItem[] = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(targetPath, entry.name);
          const stat = await fs.stat(fullPath);
          return {
            name: entry.name,
            path: path.relative(basePath, fullPath),
            isDirectory: entry.isDirectory(),
            size: stat.size,
            modifiedAt: stat.mtime
          };
        })
      );

      return files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to read directory' });
    }
  });

  app.get('/:id/files/:path*', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, path: filePath } = request.params as { id: string; path: string };
    const server = serverManager.getServer(id);
    
    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    const fullPath = path.join(server.path, filePath);
    
    if (!fullPath.startsWith(server.path)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    try {
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        return reply.redirect(`/api/servers/${id}/files?path=${filePath}`);
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      return { content, path: filePath, size: stat.size };
    } catch {
      return reply.status(404).send({ error: 'File not found' });
    }
  });

  app.put('/:id/files/:path*', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id, path: filePath } = request.params as { id: string; path: string };
    const body = request.body as { content: string };
    const server = serverManager.getServer(id);
    
    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    const fullPath = path.join(server.path, filePath);
    
    if (!fullPath.startsWith(server.path)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    try {
      await fs.writeFile(fullPath, body.content, 'utf-8');
      return { success: true, path: filePath };
    } catch {
      return reply.status(500).send({ error: 'Failed to write file' });
    }
  });

  app.delete('/:id/files/:path*', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id, path: filePath } = request.params as { id: string; path: string };
    const server = serverManager.getServer(id);
    
    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    const fullPath = path.join(server.path, filePath);
    
    if (!fullPath.startsWith(server.path)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true });
      } else {
        await fs.unlink(fullPath);
      }
      return reply.status(204).send();
    } catch {
      return reply.status(500).send({ error: 'Failed to delete' });
    }
  });

  app.post('/:id/files', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { path: string; type: 'file' | 'directory' };
    const server = serverManager.getServer(id);
    
    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    const fullPath = path.join(server.path, body.path);
    
    if (!fullPath.startsWith(server.path)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    try {
      if (body.type === 'directory') {
        await fs.mkdir(fullPath, { recursive: true });
      } else {
        await fs.writeFile(fullPath, '', 'utf-8');
      }
      return reply.status(201).send({ path: body.path });
    } catch {
      return reply.status(500).send({ error: 'Failed to create' });
    }
  });
}
