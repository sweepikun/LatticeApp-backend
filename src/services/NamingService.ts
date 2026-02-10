export type NamingTemplate = 'original' | 'categorized';

export interface NamingContext {
  originalName: string;
  pluginName: string;
  version: string;
  type: 'plugin' | 'mod';
  category?: string;
}

class NamingService {
  private readonly categoryMap: Record<string, string> = {
    // Modrinth categories
    'economy': '经济',
    'administration': '管理',
    'chat': '聊天',
    'game-mechanics': '机制',
    'transportation': '交通',
    'decoration': '装饰',
    'optimization': '优化',
    'utility': '工具',
    'adventure': '冒险',
    'equipment': '装备',
    'food': '食物',
    'magic': '魔法',
    'storage': '存储',
    'technology': '科技',
    'world-gen': '世界',
    'misc': '杂项',
    
    // Hangar categories (prefixed to avoid collisions)
    'hangar_general': '通用',
    'hangar_admin': '管理',
    'hangar_chat': '聊天',
    'hangar_economy': '经济',
    'hangar_mechanics': '机制',
    'hangar_roleplay': '角色',
    'hangar_world': '世界',
    'hangar_misc': '杂项'
  };

  formatName(context: NamingContext, template: NamingTemplate): string {
    switch (template) {
      case 'original':
        return context.originalName;
      
      case 'categorized':
        return this.formatCategorized(context);
      
      default:
        return context.originalName;
    }
  }

  private formatCategorized(context: NamingContext): string {
    const typeLetter = context.type === 'plugin' ? 'P' : 'M';
    const category = this.translateCategory(context.category) || '通用';
    const cleanName = this.cleanPluginName(context.pluginName);
    
    return `[${typeLetter}][${category}]${cleanName}-${context.version}.jar`;
  }

  private translateCategory(category?: string): string | null {
    if (!category) return null;
    const lower = category.toLowerCase();
    return this.categoryMap[lower] || this.categoryMap[this.findClosestCategory(lower)] || null;
  }

  private findClosestCategory(input: string): string {
    const lower = input.toLowerCase();
    for (const key of Object.keys(this.categoryMap)) {
      if (key.includes(lower) || lower.includes(key)) {
        return key;
      }
    }
    return 'misc';
  }

  private cleanPluginName(name: string): string {
    return name
      .replace(/[-_\s]+/g, '')
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
  }

  parseFileName(fileName: string): Partial<NamingContext> {
    // Check if it's categorized format: [P][管理]EssentialsX-2.20.1.jar
    const categorizedMatch = fileName.match(/^\[([PM])\]\[([^\]]+)\](.+)-([\d.]+)\.jar$/);
    if (categorizedMatch) {
      return {
        type: categorizedMatch[1] === 'P' ? 'plugin' : 'mod',
        category: categorizedMatch[2],
        pluginName: categorizedMatch[3],
        version: categorizedMatch[4],
        originalName: fileName
      };
    }

    // Standard format: EssentialsX-2.20.1.jar
    const standardMatch = fileName.match(/^(.+?)-([\d.]+(?:-[\w]+)?)\.jar$/i);
    if (standardMatch) {
      return {
        pluginName: standardMatch[1],
        version: standardMatch[2],
        originalName: fileName
      };
    }

    // Fallback: just remove .jar
    return {
      pluginName: fileName.replace(/\.jar$/i, '').replace(/\.disabled$/i, ''),
      originalName: fileName
    };
  }
}

export const namingService = new NamingService();
