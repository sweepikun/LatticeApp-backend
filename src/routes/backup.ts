import { FastifyInstance } from 'fastify';
import { backupService } from '../services/BackupService.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const createBackupSchema = z.object({
  name: z.string().optional()
});

export async function backupRoutes(app: FastifyInstance) {
  app.get('/:id/backups', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const backups = await backupService.listBackups(id);
    return backups;
  });

  app.post('/:id/backups', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createBackupSchema.parse(request.body);
    
    try {
      const backup = await backupService.createBackup(id, body.name);
      return reply.status(201).send(backup);
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.post('/:id/backups/restore', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { backupPath: string };
    
    try {
      await backupService.restoreBackup(body.backupPath, id);
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.delete('/backups', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    const body = request.body as { backupPath: string };
    
    try {
      await backupService.deleteBackup(body.backupPath);
      return reply.status(204).send();
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });
}
