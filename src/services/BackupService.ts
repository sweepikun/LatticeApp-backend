import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { EventEmitter } from 'events';
import { serverManager } from '../services/mc-server/ServerManager.js';

export interface BackupInfo {
  id: string;
  serverId: string;
  name: string;
  path: string;
  size: number;
  createdAt: Date;
  type: 'manual' | 'scheduled';
}

class BackupService extends EventEmitter {
  private backupsDir: string;

  constructor() {
    super();
    this.backupsDir = path.join(process.cwd(), 'backups');
  }

  async init(): Promise<void> {
    await fsPromises.mkdir(this.backupsDir, { recursive: true });
  }

  async createBackup(serverId: string, name?: string): Promise<BackupInfo> {
    const server = serverManager.getServer(serverId);
    if (!server) throw new Error('Server not found');

    const id = `${serverId}-${Date.now()}`;
    const backupName = name || `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const backupPath = path.join(this.backupsDir, `${backupName}.zip`);

    await this.zipDirectory(server.path, backupPath);

    const stat = await fsPromises.stat(backupPath);
    
    const backup: BackupInfo = {
      id,
      serverId,
      name: backupName,
      path: backupPath,
      size: stat.size,
      createdAt: new Date(),
      type: 'manual'
    };

    this.emit('created', backup);
    return backup;
  }

  async listBackups(serverId?: string): Promise<BackupInfo[]> {
    const files = await fsPromises.readdir(this.backupsDir);
    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (!file.endsWith('.zip')) continue;

      const filePath = path.join(this.backupsDir, file);
      const stat = await fsPromises.stat(filePath);
      
      // Parse server ID from filename if possible
      const match = file.match(/^(.+)-(\d{4}-\d{2}-\d{2}T.*)\.zip$/);
      const backupServerId = match ? match[1].split('-').slice(0, -3).join('-') : 'unknown';

      if (serverId && backupServerId !== serverId) continue;

      backups.push({
        id: file.replace('.zip', ''),
        serverId: backupServerId,
        name: file.replace('.zip', ''),
        path: filePath,
        size: stat.size,
        createdAt: stat.mtime,
        type: 'manual'
      });
    }

    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async restoreBackup(backupPath: string, serverId: string): Promise<void> {
    const server = serverManager.getServer(serverId);
    if (!server) throw new Error('Server not found');

    if (server.status !== 'stopped') {
      throw new Error('Server must be stopped before restoring');
    }

    // Clear server directory except for the backup itself
    const entries = await fsPromises.readdir(server.path);
    for (const entry of entries) {
      await fsPromises.rm(path.join(server.path, entry), { recursive: true, force: true });
    }

    // Extract backup
    const unzipper = await import('unzipper');
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(backupPath)
        .pipe(unzipper.Extract({ path: server.path }))
        .on('close', () => resolve())
        .on('error', reject);
    });
  }

  async deleteBackup(backupPath: string): Promise<void> {
    await fsPromises.unlink(backupPath);
    this.emit('deleted', backupPath);
  }

  private zipDirectory(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }
}

export const backupService = new BackupService();
