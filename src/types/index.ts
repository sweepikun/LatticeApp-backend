export type Role = 'admin' | 'operator' | 'moderator' | 'viewer';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Server {
  id: string;
  name: string;
  type: 'vanilla' | 'paper' | 'spigot' | 'forge' | 'fabric';
  version: string;
  path: string;
  port: number;
  status: 'stopped' | 'starting' | 'running' | 'stopping';
  createdAt: Date;
}
