import { AIProvider, ChatMessage, AIResponse } from './AIProvider.js';
import https from 'https';

export class OpenAIProvider extends AIProvider {
  private readonly baseUrl = 'https://api.openai.com/v1';

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    const body = {
      model: this.config.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.7
    };

    const response = await this.request('/chat/completions', body);
    
    return {
      content: response.choices[0].message.content,
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      }
    };
  }

  async getModels(): Promise<string[]> {
    const response = await this.request('/models', {}, 'GET');
    return response.data
      .filter((m: any) => m.id.includes('gpt'))
      .map((m: any) => m.id);
  }

  private request(endpoint: string, body: any, method: string = 'POST'): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + endpoint);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
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
      
      if (method === 'POST') {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}
