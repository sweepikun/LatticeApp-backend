import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

export type ServerType = 'vanilla' | 'paper' | 'spigot' | 'forge' | 'fabric';
export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';

export interface ServerInstance {
  id: string;
  name: string;
  type: ServerType;
  version: string;
  path: string;
  port: number;
  maxMemory: string;
  status: ServerStatus;
  process?: ChildProcess;
  createdAt: Date;
}

export interface ServerConfig {
  name: string;
  type: ServerType;
  version: string;
  port?: number;
  maxMemory?: string;
}

class ServerManager extends EventEmitter {
  private servers: Map<string, ServerInstance> = new Map();
  private serversDir: string;

  constructor() {
    super();
    this.serversDir = path.join(process.cwd(), 'servers');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.serversDir, { recursive: true });
  }

  async createServer(config: ServerConfig): Promise<ServerInstance> {
    await this.init();
    
    const id = uuidv4();
    const serverPath = path.join(this.serversDir, id);
    
    await fs.mkdir(serverPath, { recursive: true });
    await fs.mkdir(path.join(serverPath, 'world'), { recursive: true });
    
    const eulaPath = path.join(serverPath, 'eula.txt');
    await fs.writeFile(eulaPath, 'eula=true\n');

    const server: ServerInstance = {
      id,
      name: config.name,
      type: config.type,
      version: config.version,
      path: serverPath,
      port: config.port || 25565,
      maxMemory: config.maxMemory || '2G',
      status: 'stopped',
      createdAt: new Date()
    };

    const serverPropsPath = path.join(serverPath, 'server.properties');
    await fs.writeFile(serverPropsPath, this.generateServerProperties(server));

    this.servers.set(id, server);
    return server;
  }

  private generateServerProperties(server: ServerInstance): string {
    return `server-port=${server.port}
motd=Lattice Server - ${server.name}
max-players=20
online-mode=true
enable-rcon=true
rcon.port=${server.port + 10}
rcon.password=lattice
`;
  }

  async startServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) throw new Error('Server not found');
    if (server.status !== 'stopped') throw new Error('Server is not stopped');

    server.status = 'starting';
    this.emit('status', id, 'starting');

    const jarFile = path.join(server.path, `server-${server.type}-${server.version}.jar`);
    
    const args = [
      `-Xmx${server.maxMemory}`,
      '-Xms512M',
      '-jar', jarFile,
      'nogui'
    ];

    server.process = spawn('java', args, {
      cwd: server.path,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    server.process.stdout?.on('data', (data) => {
      const log = data.toString();
      this.emit('log', id, log);
      
      if (log.includes('Done!') || log.includes('For help, type "help"')) {
        server.status = 'running';
        this.emit('status', id, 'running');
      }
    });

    server.process.stderr?.on('data', (data) => {
      this.emit('log', id, data.toString());
    });

    server.process.on('close', (code) => {
      server.status = 'stopped';
      server.process = undefined;
      this.emit('status', id, 'stopped');
      this.emit('log', id, `Server stopped with code ${code}`);
    });
  }

  async stopServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) throw new Error('Server not found');
    if (server.status !== 'running') throw new Error('Server is not running');

    server.status = 'stopping';
    this.emit('status', id, 'stopping');

    await this.sendCommand(id, 'stop');
    
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        server.process?.kill('SIGKILL');
        resolve();
      }, 30000);

      server.process?.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async restartServer(id: string): Promise<void> {
    await this.stopServer(id);
    await new Promise(r => setTimeout(r, 2000));
    await this.startServer(id);
  }

  async sendCommand(id: string, command: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) throw new Error('Server not found');
    if (!server.process?.stdin) throw new Error('Server process not available');

    server.process.stdin.write(command + '\n');
  }

  async deleteServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) throw new Error('Server not found');
    
    if (server.status !== 'stopped') {
      await this.stopServer(id);
    }

    await fs.rm(server.path, { recursive: true, force: true });
    this.servers.delete(id);
  }

  getServer(id: string): ServerInstance | undefined {
    return this.servers.get(id);
  }

  getAllServers(): ServerInstance[] {
    return Array.from(this.servers.values());
  }
}

export const serverManager = new ServerManager();
