import https from 'https';

export interface HangarProject {
  id: number;
  name: string;
  namespace: { owner: string; slug: string };
  description: string;
  iconUrl?: string;
  categories: string[];
  stats: { downloads: number; stars: number; watchers: number };
  last_updated: string;
}

export interface HangarVersion {
  id: number;
  name: string;
  description?: string;
  tags: {
    name: string;
    data?: string;
    color: string;
  }[];
  downloads: number;
  created_at: string;
}

export interface HangarFile {
  versionId: number;
  fileName: string;
  fileSize: number;
  hash: string;
  downloadUrl: string;
}

class HangarService {
  private readonly baseUrl = 'https://hangar.papermc.io/api/v1';

  async searchProjects(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ result: HangarProject[]; pagination: { count: number } }> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      offset: offset.toString()
    });

    return this.request(`/projects?${params}`);
  }

  async getProject(author: string, slug: string): Promise<HangarProject> {
    return this.request(`/projects/${author}/${slug}`);
  }

  async getVersions(author: string, slug: string): Promise<HangarVersion[]> {
    return this.request(`/projects/${author}/${slug}/versions`);
  }

  async getVersionFiles(
    author: string, 
    slug: string, 
    version: string
  ): Promise<HangarFile[]> {
    return this.request(`/projects/${author}/${slug}/versions/${encodeURIComponent(version)}`);
  }

  getDownloadUrl(
    author: string, 
    slug: string, 
    version: string, 
    fileName: string
  ): string {
    return `https://hangar.papermc.io/api/v1/projects/${author}/${slug}/versions/${encodeURIComponent(version)}/${encodeURIComponent(fileName)}/download`;
  }

  private request(endpoint: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + endpoint);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Lattice-MC-Panel/1.0',
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(json.message || json.detail || 'API request failed'));
            } else {
              resolve(json);
            }
          } catch {
            reject(new Error('Failed to parse response'));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

export const hangarService = new HangarService();
