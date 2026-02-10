import { FastifyInstance } from 'fastify';
import { aiService } from '../services/AIService.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const chatSchema = z.object({
  providerId: z.string(),
  message: z.string().min(1)
});

const configureSchema = z.object({
  type: z.enum(['openai', 'claude', 'ollama']),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string()
});

const generateSchema = z.object({
  providerId: z.string(),
  description: z.string().min(10),
  platform: z.string().optional(),
  loader: z.string().optional()
});

export async function aiRoutes(app: FastifyInstance) {
  app.get('/providers', { preHandler: authMiddleware }, async () => {
    return aiService.getProviderTypes();
  });

  app.post('/configure', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    const body = configureSchema.parse(request.body);
    const providerId = uuidv4();
    
    try {
      aiService.configureProvider(providerId, body);
      return { success: true, providerId };
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.get('/models/:providerId', { preHandler: authMiddleware }, async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    
    try {
      const models = await aiService.getAvailableModels(providerId);
      return models;
    } catch {
      return [];
    }
  });

  app.post('/chat', { preHandler: authMiddleware }, async (request, reply) => {
    const body = chatSchema.parse(request.body);
    const conversationId = (request.authUser?.userId || 'default') + '-' + body.providerId;
    
    try {
      const response = await aiService.chat(conversationId, body.providerId, body.message);
      return { response };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.delete('/chat/:providerId', { preHandler: authMiddleware }, async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const conversationId = (request.authUser?.userId || 'default') + '-' + providerId;
    
    aiService.clearConversation(conversationId);
    return { success: true };
  });

  app.post('/generate/plugin', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const body = generateSchema.parse(request.body);
    
    try {
      const code = await aiService.generatePluginCode(
        body.providerId, 
        body.description, 
        body.platform || 'spigot'
      );
      return { code };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.post('/generate/mod', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const body = generateSchema.parse(request.body);
    
    try {
      const code = await aiService.generateModCode(
        body.providerId, 
        body.description, 
        body.loader || 'forge'
      );
      return { code };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });
}
