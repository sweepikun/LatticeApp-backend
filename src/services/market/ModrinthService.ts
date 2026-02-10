import https from 'https';

export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  categories: string[];
  project_type: 'mod' | 'plugin' | 'modpack' | 'resourcepack' | 'shader';
  downloads: number;
  follows: number;
  latest_version?: string;
}

export interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: {
    url: string;
    filename: string;
    size: number;
    hashes: { sha512: string; sha1: string };
  }[];
  date: string;
}

class ModrinthService {
  private readonly baseUrl = 'https://api.modrinth.com/v2';

  async searchProjects(
    query: string, 
    type: 'mod' | 'plugin' | 'modpack' = 'mod',
    limit: number = 20,
    offset: number = 0
  ): Promise<{ hits: ModrinthProject[]; total_hits: number }> {
    const facets = JSON.stringify([[`project_type:${type}`]]);
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
      offset: offset.toString(),
      facets
    });

    return this.request(`/search?${params}`);
  }

  async getProject(slug: string): Promise<ModrinthProject> {
    return this.request(`/project/${slug}`);
  }

  async getVersions(
    slug: string,
    gameVersion?: string,
    loader?: string
  ): Promise<ModrinthVersion[]> {
    let url = `/project/${slug}/version`;
    const params = new URLSearchParams();
    
    if (gameVersion) params.append('game_versions', JSON.stringify([gameVersion]));
    if (loader) params.append('loaders', JSON.stringify([loader]));
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    return this.request(url);
  }

  async getLatestVersion(
    slug: string,
    gameVersion: string,
    loader: string
  ): Promise<ModrinthVersion | null> {
    const versions = await this.getVersions(slug, gameVersion, loader);
    if (versions.length === 0) return null;

    // Sort by date and return latest
    return versions.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
  }

  getDownloadUrl(version: ModrinthVersion): string | null {
    const file = version.files.find(f => f.filename.endsWith('.jar'));
    return file?.url || null;
  }

  getFileName(version: ModrinthVersion): string {
    const file = version.files.find(f => f.filename.endsWith('.jar'));
    return file?.filename || `${version.name}.jar`;
  }

  private request(endpoint: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + endpoint);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Lattice-MC-Panel/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(json.description || json.error || 'API request failed'));
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

export const modrinthService = new ModrinthService();
