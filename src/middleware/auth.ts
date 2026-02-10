import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTPayload, Role } from '../types/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: JWTPayload;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const decoded = await request.server.jwt.verify(token) as JWTPayload;
    request.authUser = decoded;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

const roleHierarchy: Record<Role, number> = {
  admin: 4,
  operator: 3,
  moderator: 2,
  viewer: 1
};

export function requireRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const userLevel = roleHierarchy[request.authUser.role];
    const requiredLevel = roleHierarchy[minRole];

    if (userLevel < requiredLevel) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
