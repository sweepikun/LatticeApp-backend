import { Role, User } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

class UserModel {
  private users: Map<string, User> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const data = await fs.readFile(USERS_FILE, 'utf-8');
      const users: User[] = JSON.parse(data);
      users.forEach(u => this.users.set(u.id, u));
    } catch {
      // File doesn't exist, start fresh
    }
    this.initialized = true;
  }

  private async save(): Promise<void> {
    const users = Array.from(this.users.values());
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    await this.init();
    
    const user: User = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(user.id, user);
    await this.save();
    return user;
  }

  async findById(id: string): Promise<User | null> {
    await this.init();
    return this.users.get(id) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    await this.init();
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    await this.init();
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    await this.init();
    const user = this.users.get(id);
    if (!user) return null;
    
    Object.assign(user, data, { updatedAt: new Date() });
    this.users.set(id, user);
    await this.save();
    return user;
  }

  async delete(id: string): Promise<boolean> {
    await this.init();
    const result = this.users.delete(id);
    if (result) await this.save();
    return result;
  }

  async findAll(): Promise<User[]> {
    await this.init();
    return Array.from(this.users.values());
  }
}

export const userModel = new UserModel();
