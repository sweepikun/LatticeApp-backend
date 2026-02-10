import { AIProvider, ChatMessage, AIResponse, AIProviderConfig } from './AIProvider.js';
import http from 'http';

export class OllamaProvider extends AIProvider {
  private readonly baseUrl: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    const body = {
      model: this.config.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false
    };

    const response = await this.request('/api/chat', body);
    
    return {
      content: response.message.content,
      model: response.model,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
      }
    };
  }

  async getModels(): Promise<string[]> {
    const response = await this.request('/api/tags', {}, 'GET');
    return response.models?.map((m: any) => m.name) || [];
  }

  private request(endpoint: string, body: any, method: string = 'POST'): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + endpoint);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 11434,
        path: url.pathname,
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(json.error || 'API request failed'));
            } else {
              resolve(json);
            }
          } catch {
            reject(new Error('Failed to parse response'));
          }
        });
      });

      req.on('error', reject);
      
      if (method === 'POST') {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}
