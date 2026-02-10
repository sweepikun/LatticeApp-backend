import { AIProvider, ChatMessage, AIResponse } from './AIProvider.js';
import https from 'https';

export class ClaudeProvider extends AIProvider {
  private readonly baseUrl = 'https://api.anthropic.com/v1';

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: this.config.model,
      max_tokens: 4096,
      system: systemMessage?.content || 'You are a helpful assistant.',
      messages: chatMessages.map(m => ({ role: m.role, content: m.content }))
    };

    const response = await this.request('/messages', body);
    
    return {
      content: response.content[0].text,
      model: response.model,
      usage: {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }

  async getModels(): Promise<string[]> {
    return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
  }

  private request(endpoint: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + endpoint);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2024-01-01'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(json.error?.message || 'API request failed'));
            } else {
              resolve(json);
            }
          } catch {
            reject(new Error('Failed to parse response'));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}
