import { EventEmitter } from 'events';
import { serverManager } from '../services/mc-server/ServerManager.js';
import child_process from 'child_process';

export interface ServerStats {
  serverId: string;
  timestamp: Date;
  cpu: number;
  memory: number;
  memoryUsed: number;
  memoryTotal: number;
  uptime: number;
  players: number;
  tps: number;
}

class MonitorService extends EventEmitter {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private stats: Map<string, ServerStats[]> = new Map();

  startMonitoring(serverId: string, intervalMs: number = 5000): void {
    if (this.intervals.has(serverId)) return;

    const interval = setInterval(() => {
      this.collectStats(serverId);
    }, intervalMs);

    this.intervals.set(serverId, interval);
  }

  stopMonitoring(serverId: string): void {
    const interval = this.intervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(serverId);
    }
  }

  private async collectStats(serverId: string): Promise<void> {
    const server = serverManager.getServer(serverId);
    if (!server || server.status !== 'running') return;

    try {
      const stats = await this.getServerProcessStats(serverId);
      
      if (!this.stats.has(serverId)) {
        this.stats.set(serverId, []);
      }
      
      const serverStats = this.stats.get(serverId)!;
      serverStats.push(stats);
      
      // Keep last 100 data points
      if (serverStats.length > 100) {
        serverStats.shift();
      }

      this.emit('stats', serverId, stats);
    } catch {
      // Ignore collection errors
    }
  }

  private async getServerProcessStats(serverId: string): Promise<ServerStats> {
    const server = serverManager.getServer(serverId);
    if (!server) throw new Error('Server not found');

    const pid = server.process?.pid;
    
    let cpu = 0;
    let memoryUsed = 0;
    let memoryTotal = 0;
    let memory = 0;

    if (pid) {
      try {
        // Get process stats using tasklist (Windows) or ps (Unix)
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
          const output = child_process.execSync(
            `wmic process where processid=${pid} get workingsetsize,creationdate /format:csv`,
            { encoding: 'utf-8' }
          ).toString();
          
          const lines = output.trim().split('\n').filter(l => l.includes(pid.toString()));
          if (lines.length > 0) {
            const parts = lines[0].split(',');
            memoryUsed = parseInt(parts[parts.length - 1]) / (1024 * 1024);
          }
        } else {
          const output = child_process.execSync(
            `ps -p ${pid} -o rss=,%cpu=`,
            { encoding: 'utf-8' }
          ).toString();
          
          const [rss, cpuStr] = output.trim().split(/\s+/);
          memoryUsed = parseFloat(rss) / 1024;
          cpu = parseFloat(cpuStr);
        }

        // Get total system memory
        if (isWindows) {
          const memOutput = child_process.execSync(
            'wmic OS get TotalVisibleMemorySize /Value',
            { encoding: 'utf-8' }
          ).toString();
          const match = memOutput.match(/TotalVisibleMemorySize=(\d+)/);
          memoryTotal = match ? parseInt(match[1]) / 1024 : 16384;
        } else {
          const memOutput = child_process.execSync(
            'cat /proc/meminfo | grep MemTotal',
            { encoding: 'utf-8' }
          ).toString();
          const match = memOutput.match(/(\d+)/);
          memoryTotal = match ? parseInt(match[1]) / 1024 : 16384;
        }

        memory = (memoryUsed / memoryTotal) * 100;
      } catch {
        // Fallback values
        cpu = 0;
        memory = 0;
        memoryUsed = 0;
        memoryTotal = 16384;
      }
    }

    return {
      serverId,
      timestamp: new Date(),
      cpu,
      memory,
      memoryUsed: Math.round(memoryUsed),
      memoryTotal: Math.round(memoryTotal),
      uptime: 0,
      players: 0,
      tps: 20.0
    };
  }

  getStats(serverId: string): ServerStats[] {
    return this.stats.get(serverId) || [];
  }

  getLatestStats(serverId: string): ServerStats | null {
    const stats = this.stats.get(serverId);
    return stats && stats.length > 0 ? stats[stats.length - 1] : null;
  }
}

export const monitorService = new MonitorService();
