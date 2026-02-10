import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { ServerType } from './ServerManager.js';

interface VersionInfo {
  id: string;
  url: string;
}

class CoreDownloader {
  private static readonly VANILLA_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
  private static readonly PAPER_API = 'https://api.papermc.io/v2';
  
  async getAvailableVersions(type: ServerType): Promise<string[]> {
    switch (type) {
      case 'vanilla':
        return this.getVanillaVersions();
      case 'paper':
        return this.getPaperVersions();
      default:
        return ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.19.2', '1.18.2'];
    }
  }

  private async getVanillaVersions(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      https.get(CoreDownloader.VANILLA_MANIFEST, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const manifest = JSON.parse(data);
            const versions = manifest.versions
              .slice(0, 50)
              .map((v: { id: string }) => v.id);
            resolve(versions);
          } catch {
            reject(new Error('Failed to parse version manifest'));
          }
        });
      }).on('error', reject);
    });
  }

  private async getPaperVersions(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      https.get(`${CoreDownloader.PAPER_API}/projects/paper`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result.versions.slice(0, 20));
          } catch {
            reject(new Error('Failed to parse Paper versions'));
          }
        });
      }).on('error', reject);
    });
  }

  async downloadCore(
    type: ServerType, 
    version: string, 
    targetPath: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const url = await this.getDownloadUrl(type, version);
    const fileName = `server-${type}-${version}.jar`;
    const filePath = path.join(targetPath, fileName);

    await this.downloadFile(url, filePath, onProgress);
    return filePath;
  }

  private async getDownloadUrl(type: ServerType, version: string): Promise<string> {
    switch (type) {
      case 'vanilla':
        return this.getVanillaUrl(version);
      case 'paper':
        return this.getPaperUrl(version);
      default:
        throw new Error(`Unsupported server type: ${type}`);
    }
  }

  private async getVanillaUrl(version: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(CoreDownloader.VANILLA_MANIFEST, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const manifest = JSON.parse(data);
            const versionInfo = manifest.versions.find((v: { id: string }) => v.id === version);
            if (!versionInfo) throw new Error('Version not found');

            https.get(versionInfo.url, (res2) => {
              let versionData = '';
              res2.on('data', chunk => versionData += chunk);
              res2.on('end', () => {
                const versionManifest = JSON.parse(versionData);
                resolve(versionManifest.downloads.server.url);
              });
            }).on('error', reject);
          } catch {
            reject(new Error('Failed to get vanilla download URL'));
          }
        });
      }).on('error', reject);
    });
  }

  private async getPaperUrl(version: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(`${CoreDownloader.PAPER_API}/projects/paper/versions/${version}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            const build = result.builds[result.builds.length - 1];
            resolve(
              `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${build}/downloads/paper-${version}-${build}.jar`
            );
          } catch {
            reject(new Error('Failed to get Paper download URL'));
          }
        });
      }).on('error', reject);
    });
  }

  private downloadFile(url: string, filePath: string, onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, async (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          await this.downloadFile(res.headers.location!, filePath, onProgress);
          resolve();
          return;
        }

        const totalSize = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;

        const file = await fs.open(filePath, 'w');
        const writeStream = file.createWriteStream();

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalSize && onProgress) {
            onProgress(Math.round((downloaded / totalSize) * 100));
          }
        });

        res.pipe(writeStream);

        writeStream.on('finish', async () => {
          writeStream.close();
          await file.close();
          resolve();
        });

        writeStream.on('error', reject);
      }).on('error', reject);
    });
  }
}

export const coreDownloader = new CoreDownloader();
