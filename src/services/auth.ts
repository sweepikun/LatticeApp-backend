import { Role, User, AuthTokens, JWTPayload } from '../types/index.js';
import { userModel } from '../models/user.js';
import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

class AuthService {
  private app: FastifyInstance | null = null;

  init(app: FastifyInstance) {
    this.app = app;
  }

  async register(username: string, email: string, password: string, role: Role = 'viewer'): Promise<User> {
    const existingUser = await userModel.findByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const existingEmail = await userModel.findByEmail(email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    return userModel.create({
      username,
      email,
      passwordHash,
      role
    });
  }

  async login(username: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await userModel.findByUsername(username);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    return { user, tokens };
  }

  async generateTokens(user: User): Promise<AuthTokens> {
    if (!this.app) throw new Error('AuthService not initialized');

    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    const accessToken = this.app.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = this.app.jwt.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRY });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    if (!this.app) throw new Error('AuthService not initialized');

    try {
      const decoded = await this.app.jwt.verify(refreshToken) as JWTPayload;
      const user = await userModel.findById(decoded.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  async validateToken(token: string): Promise<JWTPayload> {
    if (!this.app) throw new Error('AuthService not initialized');
    return this.app.jwt.verify(token) as Promise<JWTPayload>;
  }
}

export const authService = new AuthService();
