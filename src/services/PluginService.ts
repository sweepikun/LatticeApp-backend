import fs from 'fs/promises';
import path from 'path';
import { serverManager } from '../services/mc-server/ServerManager.js';

export interface PluginInfo {
  name: string;
  fileName: string;
  path: string;
  enabled: boolean;
  version?: string;
  description?: string;
  author?: string;
  size: number;
  modifiedAt: Date;
  type: 'plugin' | 'mod';
}

class PluginService {
  async getPlugins(serverId: string, type: 'plugin' | 'mod' = 'plugin'): Promise<PluginInfo[]> {
    const server = serverManager.getServer(serverId);
    if (!server) throw new Error('Server not found');

    const pluginDir = type === 'plugin' 
      ? path.join(server.path, 'plugins')
      : path.join(server.path, 'mods');

    try {
      await fs.mkdir(pluginDir, { recursive: true });
    } catch {
      // Directory exists
    }

    const files = await fs.readdir(pluginDir);
    const plugins: PluginInfo[] = [];

    for (const file of files) {
      if (!file.endsWith('.jar') && !file.endsWith('.jar.disabled')) continue;
      
      const filePath = path.join(pluginDir, file);
      const stat = await fs.stat(filePath);
      
      const isDisabled = file.endsWith('.disabled');
      const fileName = isDisabled ? file.replace('.disabled', '') : file;
      
      const plugin: PluginInfo = {
        name: this.parsePluginName(fileName),
        fileName: file,
        path: filePath,
        enabled: !isDisabled,
        version: this.parseVersion(fileName),
        size: stat.size,
        modifiedAt: stat.mtime,
        type
      };

      plugins.push(plugin);
    }

    return plugins.sort((a, b) => a.name.localeCompare(b.name));
  }

  async enablePlugin(serverId: string, pluginPath: string): Promise<void> {
    const server = serverManager.getServer(serverId);
    if (!server) throw new Error('Server not found');

    if (!pluginPath.endsWith('.disabled')) {
      throw new Error('Plugin is already enabled');
    }

    const newPath = pluginPath.replace('.disabled', '');
    await fs.rename(pluginPath, newPath);
  }

  async disablePlugin(serverId: string, pluginPath: string): Promise<void> {
    const server = serverManager.getServer(serverId);
    if (!server) throw new Error('Server not found');

    if (pluginPath.endsWith('.disabled')) {
      throw new Error('Plugin is already disabled');
    }

    const newPath = pluginPath + '.disabled';
    await fs.rename(pluginPath, newPath);
  }

  async deletePlugin(serverId: string, pluginPath: string): Promise<void> {
    const server = serverManager.getServer(serverId);
    if (!server) throw new Error('Server not found');

    await fs.unlink(pluginPath);
  }

  async getPluginPath(serverId: string, type: 'plugin' | 'mod' = 'plugin'): Promise<string> {
    const server = serverManager.getServer(serverId);
    if (!server) throw new Error('Server not found');

    const pluginDir = type === 'plugin' 
      ? path.join(server.path, 'plugins')
      : path.join(server.path, 'mods');

    await fs.mkdir(pluginDir, { recursive: true });
    return pluginDir;
  }

  private parsePluginName(fileName: string): string {
    // Remove .jar extension
    let name = fileName.replace('.jar', '');
    
    // Try to extract name from common patterns
    // Pattern: name-version.jar
    const versionMatch = name.match(/^(.+?)-[\d].*$/);
    if (versionMatch) {
      return versionMatch[1].replace(/[-_]/g, ' ').trim();
    }
    
    return name.replace(/[-_]/g, ' ').trim();
  }

  private parseVersion(fileName: string): string | undefined {
    const match = fileName.match(/-([\d]+\.[\d]+(?:\.[\d]+)?(?:-[\w]+)?)\.jar/);
    return match ? match[1] : undefined;
  }
}

export const pluginService = new PluginService();
