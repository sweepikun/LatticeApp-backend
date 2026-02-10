import { FastifyInstance } from 'fastify';
import { authService } from '../services/auth.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(['admin', 'operator', 'moderator', 'viewer']).optional()
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string()
});

const refreshSchema = z.object({
  refreshToken: z.string()
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    
    try {
      const user = await authService.register(
        body.username,
        body.email,
        body.password,
        body.role
      );

      return reply.status(201).send({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      });
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    try {
      const { user, tokens } = await authService.login(body.username, body.password);
      
      return reply.send({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        ...tokens
      });
    } catch (err) {
      const error = err as Error;
      return reply.status(401).send({ error: error.message });
    }
  });

  app.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);

    try {
      const tokens = await authService.refresh(body.refreshToken);
      return reply.send(tokens);
    } catch (err) {
      const error = err as Error;
      return reply.status(401).send({ error: error.message });
    }
  });

  app.get('/me', { preHandler: authMiddleware }, async (request, reply) => {
    return reply.send(request.authUser);
  });
}
