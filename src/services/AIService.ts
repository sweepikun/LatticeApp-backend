import { AIProvider, ChatMessage, AIProviderConfig } from './ai/AIProvider.js';
import { OpenAIProvider } from './ai/OpenAIProvider.js';
import { ClaudeProvider } from './ai/ClaudeProvider.js';
import { OllamaProvider } from './ai/OllamaProvider.js';

type ProviderType = 'openai' | 'claude' | 'ollama';

interface ProviderSettings {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

class AIService {
  private providers: Map<string, AIProvider> = new Map();
  private settings: Map<string, ProviderSettings> = new Map();
  private conversations: Map<string, ChatMessage[]> = new Map();

  private readonly systemPrompt = `You are an expert Minecraft server administrator and plugin/mod developer. 
You help users with:
- Minecraft server configuration and optimization
- Plugin and mod development (Bukkit, Spigot, Paper, Forge, Fabric)
- Server troubleshooting and debugging
- Performance tuning and best practices
- Command usage and automation

Provide clear, actionable advice with code examples when appropriate.`;

  getProviderTypes(): { id: ProviderType; name: string }[] {
    return [
      { id: 'openai', name: 'OpenAI (GPT)' },
      { id: 'claude', name: 'Anthropic (Claude)' },
      { id: 'ollama', name: 'Ollama (Local)' }
    ];
  }

  configureProvider(id: string, settings: ProviderSettings): void {
    this.settings.set(id, settings);
    
    const config: AIProviderConfig = {
      apiKey: settings.apiKey || '',
      baseUrl: settings.baseUrl,
      model: settings.model
    };

    let provider: AIProvider;
    switch (settings.type) {
      case 'openai':
        provider = new OpenAIProvider(config);
        break;
      case 'claude':
        provider = new ClaudeProvider(config);
        break;
      case 'ollama':
        provider = new OllamaProvider(config);
        break;
      default:
        throw new Error(`Unknown provider type: ${settings.type}`);
    }

    this.providers.set(id, provider);
  }

  async getAvailableModels(providerId: string): Promise<string[]> {
    const provider = this.providers.get(providerId);
    if (!provider) return [];
    
    try {
      return await provider.getModels();
    } catch {
      return [];
    }
  }

  async chat(conversationId: string, providerId: string, message: string): Promise<string> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('AI provider not configured');
    }

    let messages = this.conversations.get(conversationId);
    if (!messages) {
      messages = [{ role: 'system', content: this.systemPrompt }];
      this.conversations.set(conversationId, messages);
    }

    messages.push({ role: 'user', content: message });

    try {
      const response = await provider.chat(messages);
      messages.push({ role: 'assistant', content: response.content });
      return response.content;
    } catch (err) {
      messages.pop();
      throw err;
    }
  }

  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  async generatePluginCode(providerId: string, description: string, platform: string): Promise<string> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('AI provider not configured');
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      { 
        role: 'user', 
        content: `Generate a ${platform} plugin with the following functionality:

${description}

Please provide:
1. Main plugin class
2. plugin.yml configuration
3. Any additional required classes
4. Brief explanation of how to use it

Format your response with proper code blocks.` 
      }
    ];

    const response = await provider.chat(messages);
    return response.content;
  }

  async generateModCode(providerId: string, description: string, loader: string): Promise<string> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('AI provider not configured');
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      { 
        role: 'user', 
        content: `Generate a ${loader} mod with the following functionality:

${description}

Please provide:
1. Main mod class
2. Required mixin classes if needed
3. mods.toml or fabric.mod.json configuration
4. Brief explanation of how to use it

Format your response with proper code blocks.` 
      }
    ];

    const response = await provider.chat(messages);
    return response.content;
  }
}

export const aiService = new AIService();
