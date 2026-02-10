import { FastifyInstance } from 'fastify';
import { monitorService } from '../services/MonitorService.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

export async function monitorRoutes(app: FastifyInstance) {
  app.get('/:id/stats', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const stats = monitorService.getStats(id);
    return stats;
  });

  app.get('/:id/stats/latest', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const stats = monitorService.getLatestStats(id);
    if (!stats) {
      return reply.status(404).send({ error: 'No stats available' });
    }
    return stats;
  });

  app.post('/:id/monitor/start', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    monitorService.startMonitoring(id);
    return { success: true };
  });

  app.post('/:id/monitor/stop', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    monitorService.stopMonitoring(id);
    return { success: true };
  });
}
