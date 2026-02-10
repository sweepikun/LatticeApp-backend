import { FastifyInstance } from 'fastify';
import { pluginService } from '../services/PluginService.js';
import { modrinthService } from '../services/market/ModrinthService.js';
import { hangarService } from '../services/market/HangarService.js';
import { namingService, NamingTemplate } from '../services/NamingService.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';

const uploadSchema = z.object({
  fileName: z.string(),
  content: z.string(),
  type: z.enum(['plugin', 'mod']).optional()
});

const downloadSchema = z.object({
  type: z.enum(['plugin', 'mod']),
  namingTemplate: z.enum(['original', 'categorized']).optional(),
  category: z.string().optional()
});

export async function pluginRoutes(app: FastifyInstance) {
  // ==================== Local Plugin Management ====================
  
  app.get('/:id/plugins', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { type?: string };
    
    try {
      const plugins = await pluginService.getPlugins(id, (query.type as 'plugin' | 'mod') || 'plugin');
      return plugins;
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.post('/:id/plugins/:type/enable', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { path: string };
    
    try {
      await pluginService.enablePlugin(id, body.path);
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.post('/:id/plugins/:type/disable', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { path: string };
    
    try {
      await pluginService.disablePlugin(id, body.path);
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.delete('/:id/plugins', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { path: string };
    
    try {
      await pluginService.deletePlugin(id, body.path);
      return reply.status(204).send();
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });

  app.post('/:id/plugins/upload', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = uploadSchema.parse(request.body);
    const type = body.type || 'plugin';
    
    try {
      const pluginDir = await pluginService.getPluginPath(id, type);
      const filePath = path.join(pluginDir, body.fileName);
      
      const buffer = Buffer.from(body.content, 'base64');
      await fs.writeFile(filePath, buffer);

      return { 
        success: true, 
        fileName: body.fileName,
        path: filePath 
      };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // ==================== Modrinth Market ====================
  
  app.get('/:id/market/modrinth/search', { preHandler: authMiddleware }, async (request, reply) => {
    const query = request.query as { q: string; type?: string; limit?: string; offset?: string };
    
    try {
      const result = await modrinthService.searchProjects(
        query.q,
        (query.type as 'mod' | 'plugin') || 'mod',
        parseInt(query.limit || '20'),
        parseInt(query.offset || '0')
      );
      return result;
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.get('/:id/market/modrinth/project/:slug', { preHandler: authMiddleware }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    
    try {
      const project = await modrinthService.getProject(slug);
      return project;
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.get('/:id/market/modrinth/versions/:slug', { preHandler: authMiddleware }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const query = request.query as { gameVersion?: string; loader?: string };
    
    try {
      const versions = await modrinthService.getVersions(slug, query.gameVersion, query.loader);
      return versions;
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.post('/:id/market/modrinth/download', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      slug: string;
      versionId: string;
      gameVersion: string;
      loader: string;
      namingTemplate?: NamingTemplate;
      category?: string;
    };
    
    try {
      const versions = await modrinthService.getVersions(body.slug, body.gameVersion, body.loader);
      const version = versions.find(v => v.id === body.versionId);
      if (!version) {
        return reply.status(404).send({ error: 'Version not found' });
      }

      const downloadUrl = modrinthService.getDownloadUrl(version);
      if (!downloadUrl) {
        return reply.status(400).send({ error: 'No downloadable file found' });
      }

      const originalName = modrinthService.getFileName(version);
      const pluginName = body.slug;
      const versionNumber = version.version_number;
      
      const finalName = namingService.formatName({
        originalName,
        pluginName,
        version: versionNumber,
        type: 'mod',
        category: body.category
      }, body.namingTemplate || 'original');

      const pluginDir = await pluginService.getPluginPath(id, 'mod');
      const filePath = path.join(pluginDir, finalName);

      await downloadFile(downloadUrl, filePath);

      return { 
        success: true, 
        fileName: finalName,
        path: filePath,
        originalName
      };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // ==================== Hangar Market (Paper/Velocity plugins) ====================
  
  app.get('/:id/market/hangar/search', { preHandler: authMiddleware }, async (request, reply) => {
    const query = request.query as { q: string; limit?: string; offset?: string };
    
    try {
      const result = await hangarService.searchProjects(
        query.q,
        parseInt(query.limit || '20'),
        parseInt(query.offset || '0')
      );
      return result;
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.get('/:id/market/hangar/project/:author/:slug', { preHandler: authMiddleware }, async (request, reply) => {
    const { author, slug } = request.params as { author: string; slug: string };
    
    try {
      const project = await hangarService.getProject(author, slug);
      return project;
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.get('/:id/market/hangar/versions/:author/:slug', { preHandler: authMiddleware }, async (request, reply) => {
    const { author, slug } = request.params as { author: string; slug: string };
    
    try {
      const versions = await hangarService.getVersions(author, slug);
      return versions;
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  app.post('/:id/market/hangar/download', { preHandler: [authMiddleware, requireRole('operator')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      author: string;
      slug: string;
      version: string;
      fileName: string;
      namingTemplate?: NamingTemplate;
      category?: string;
    };
    
    try {
      const downloadUrl = hangarService.getDownloadUrl(body.author, body.slug, body.version, body.fileName);
      const pluginName = body.slug;
      
      // Extract version from fileName or version string
      const versionMatch = body.fileName.match(/[\d]+\.[\d]+(?:\.[\d]+)?/);
      const versionNumber = versionMatch ? versionMatch[0] : body.version;

      const finalName = namingService.formatName({
        originalName: body.fileName,
        pluginName,
        version: versionNumber,
        type: 'plugin',
        category: body.category
      }, body.namingTemplate || 'original');

      const pluginDir = await pluginService.getPluginPath(id, 'plugin');
      const filePath = path.join(pluginDir, finalName);

      await downloadFile(downloadUrl, filePath);

      return { 
        success: true, 
        fileName: finalName,
        path: filePath,
        originalName: body.fileName
      };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // ==================== Naming Preview ====================
  
  app.post('/naming/preview', { preHandler: authMiddleware }, async (request, reply) => {
    const body = request.body as {
      originalName: string;
      pluginName: string;
      version: string;
      type: 'plugin' | 'mod';
      category?: string;
      template: NamingTemplate;
    };

    return {
      original: body.originalName,
      categorized: namingService.formatName({ ...body, category: body.category }, 'categorized')
    };
  });
}

function downloadFile(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const file = require('fs').createWriteStream(filePath);
    
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        require('fs').unlinkSync(filePath);
        downloadFile(res.headers.location!, filePath).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        file.close();
        require('fs').unlinkSync(filePath);
        reject(new Error(`Download failed with status ${res.statusCode}`));
        return;
      }

      res.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      require('fs').unlinkSync(filePath);
      reject(err);
    });
  });
}
