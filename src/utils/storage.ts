// src/utils/storage.ts
import { APISettings, BookProject, ModelID, ModelProvider } from '../types';
import { DEFAULT_ZHIPU_MODEL, ZHIPU_PROVIDER } from '../constants/ai';

const SETTINGS_KEY = 'pustakam-settings';
const BOOKS_KEY = 'pustakam-books';

// Get user-scoped books key
const getUserBooksKey = (userId?: string | null): string => {
  if (userId) {
    return `pustakam-books-${userId}`;
  }
  return BOOKS_KEY;
};

const defaultSettings: APISettings = {
  googleApiKey: '',
  mistralApiKey: '',
  groqApiKey: '',
  cerebrasApiKey: '',
  xaiApiKey: '',
  openRouterApiKey: '',
  cohereApiKey: '',
  selectedProvider: ZHIPU_PROVIDER,
  selectedModel: DEFAULT_ZHIPU_MODEL,
  defaultGenerationMode: 'stellar',
  defaultLanguage: 'en',
};

// Valid providers list
const validProviders: ModelProvider[] = ['zhipu', 'cerebras', 'google', 'mistral', 'xai', 'groq', 'openrouter', 'cohere'];

// Valid models per provider
const validModels: Record<ModelProvider, ModelID[]> = {
  zhipu: ['glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.7-flashx'],
  cerebras: ['gpt-oss-120b', 'qwen-3-235b-a22b-instruct-2507', 'zai-glm-4.7', 'llama-3.3-70b', 'llama3.1-8b'],
  google: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemma-3-27b-it'],
  mistral: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
  xai: ['grok-4.1', 'grok-4.1-fast', 'grok-4-fast'],
  groq: ['llama-3.3-70b-versatile', 'moonshotai/kimi-k2-instruct-0905', 'groq/compound', 'openai/gpt-oss-20b'],
  openrouter: ['arcee-ai/trinity-large-preview:free', 'arcee-ai/trinity-mini:free', 'tngtech/deepseek-r1t2-chimera:free', 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free'],
  cohere: ['command-a-03-2025', 'command-r-plus-08-2024'],
};

export const storageUtils = {
  getSettings(): APISettings {
    try {
      const useProxy = import.meta.env.VITE_USE_PROXY === 'true';
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (!stored) return defaultSettings;

      const parsed = JSON.parse(stored);

      const settings: APISettings = {
        ...defaultSettings,
        ...parsed,
      };

      // Validate provider
      if (!settings.selectedProvider || !validProviders.includes(settings.selectedProvider)) {
        console.warn('Invalid selectedProvider found in storage:', settings.selectedProvider);
        settings.selectedProvider = defaultSettings.selectedProvider;
      }

      if (useProxy) {
        settings.selectedProvider = ZHIPU_PROVIDER;
      }

      // Validate models
      const providerModels = validModels[settings.selectedProvider];
      if (!providerModels.includes(settings.selectedModel)) {
        console.warn(`Invalid model ${settings.selectedModel} for provider ${settings.selectedProvider}`);
        settings.selectedModel = providerModels[0];
      }

      return settings;
    } catch (error) {
      console.error('Error loading settings:', error);
      localStorage.removeItem(SETTINGS_KEY);
      return defaultSettings;
    }
  },

  saveSettings(settings: APISettings): void {
    try {
      const useProxy = import.meta.env.VITE_USE_PROXY === 'true';
      if (!settings.selectedProvider || !validProviders.includes(settings.selectedProvider)) {
        console.error('Attempted to save invalid selectedProvider:', settings.selectedProvider);
        settings.selectedProvider = defaultSettings.selectedProvider;
      }

      if (useProxy) {
        settings.selectedProvider = ZHIPU_PROVIDER;
        if (!validModels[ZHIPU_PROVIDER].includes(settings.selectedModel)) {
          settings.selectedModel = DEFAULT_ZHIPU_MODEL;
        }
      }

      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
      // Silently fail - the app will use defaults
    }
  },

  getBooks(userId?: string | null): BookProject[] {
    try {
      const key = getUserBooksKey(userId);
      const stored = localStorage.getItem(key);

      // Migration: If user-specific key is empty and user is logged in,
      // check if there are books in the old generic key and migrate them
      if (!stored && userId) {
        const oldBooks = localStorage.getItem(BOOKS_KEY);
        if (oldBooks) {
          // Migrate old books to user-specific key
          localStorage.setItem(key, oldBooks);
          // Clear old generic key to prevent duplicate loading
          localStorage.removeItem(BOOKS_KEY);
          console.log('Migrated books from generic key to user-specific key');
          const books = JSON.parse(oldBooks);
          return books.map((book: BookProject) => ({
            ...book,
            createdAt: new Date(book.createdAt),
            updatedAt: new Date(book.updatedAt),
          }));
        }
      }

      if (!stored) return [];
      const books = JSON.parse(stored);
      return books.map((book: BookProject) => ({
        ...book,
        createdAt: new Date(book.createdAt),
        updatedAt: new Date(book.updatedAt),
      }));
    } catch (error) {
      console.error('Error loading books:', error);
      return [];
    }
  },

  saveBooks(books: BookProject[], userId?: string | null): void {
    try {
      const key = getUserBooksKey(userId);
      localStorage.setItem(key, JSON.stringify(books));
    } catch (error) {
      console.error('Error saving books:', error);
      // Silently fail - books are also saved in state
    }
  },

  clearBooks(userId?: string | null): void {
    const key = getUserBooksKey(userId);
    localStorage.removeItem(key);
  },

  clearAll(userId?: string | null): void {
    localStorage.removeItem(SETTINGS_KEY);
    const key = getUserBooksKey(userId);
    localStorage.removeItem(key);
  },
};
