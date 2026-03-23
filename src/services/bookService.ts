// ============================================================================
// FILE: src/services/bookService.ts
// FIXES:
//   1. validateSettings() — auto-correct provider; never error-out in proxy mode
//   2. generateWithAI() proxy — 90s timeout + full console logging so errors
//      are ALWAYS visible in DevTools, never swallowed silently
//   3. getApiKeyForProvider() — zhipu is proxy-only, never needs a local key
//   4. enhanceBookInput() — wraps errors so isEnhancing always resets
// ============================================================================

import { BookProject, BookRoadmap, BookModule, RoadmapModule, BookSession } from '../types/book';
import { APISettings, ModelProvider } from '../types';
import { generateId } from '../utils/helpers';
import { planService } from './planService';
import { streetPromptService } from './streetPromptService';
import { desiPromptService } from './desiPromptService';
import { AI_SUITE_NAME, DEFAULT_ZHIPU_MODEL, ZHIPU_PROVIDER } from '../constants/ai';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Debug helper — always logs so DevTools console is never blank ────────────
const dbg = (...args: unknown[]) => console.log('[BookService]', ...args);
const err = (...args: unknown[]) => console.error('[BookService]', ...args);

interface GenerationCheckpoint {
  bookId: string;
  completedModuleIds: string[];
  failedModuleIds: string[];
  moduleRetryCount: Record<string, number>;
  lastSuccessfulIndex: number;
  timestamp: string;
  totalWordsGenerated: number;
}

export interface GenerationStatus {
  currentModule?: {
    id: string;
    title: string;
    attempt: number;
    progress: number;
    generatedText?: string;
  };
  totalProgress: number;
  status: 'idle' | 'generating' | 'completed' | 'error' | 'paused' | 'waiting_retry';
  logMessage?: string;
  totalWordsGenerated?: number;
  aiStage?: 'analyzing' | 'writing' | 'examples' | 'polishing' | 'complete';
  retryInfo?: {
    moduleTitle: string;
    error: string;
    retryCount: number;
    maxRetries: number;
    waitTime?: number;
  };
}

export interface EnhancedBookData {
  goal: string;
  title: string;
  targetAudience: string;
  complexityLevel: 'beginner' | 'intermediate' | 'advanced';
  preferences: {
    includeExamples: boolean;
    includePracticalExercises: boolean;
    includeQuizzes: boolean;
  };
  reasoning?: string;
}

class BookGenerationService {
  private settings: APISettings = {
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

  private onProgressUpdate?: (bookId: string, updates: Partial<BookProject>) => void;
  private onGenerationStatusUpdate?: (bookId: string, status: Partial<GenerationStatus>) => void;
  private requestTimeout = 360000;
  private activeRequests = new Map<string, AbortController>();
  private checkpoints = new Map<string, GenerationCheckpoint>();
  private currentGeneratedTexts = new Map<string, string>();
  private userRetryDecisions = new Map<string, 'retry' | 'switch' | 'skip'>();

  private readonly MAX_MODULE_RETRIES = 5;
  private readonly RETRY_DELAY_BASE = 3000;
  private readonly MAX_RETRY_DELAY = 30000;
  private readonly RATE_LIMIT_DELAY = 5000;

  // ============================================================================
  // SETTINGS & CALLBACKS
  // ============================================================================

  updateSettings(settings: APISettings) {
    this.settings = settings;
  }

  setProgressCallback(callback: (bookId: string, updates: Partial<BookProject>) => void) {
    this.onProgressUpdate = callback;
  }

  setGenerationStatusCallback(callback: (bookId: string, status: Partial<GenerationStatus>) => void) {
    this.onGenerationStatusUpdate = callback;
  }

  // ============================================================================
  // AI ENHANCER
  // ============================================================================

  public async enhanceBookInput(userInput: string, generationMode?: 'stellar' | 'blackhole'): Promise<EnhancedBookData> {
    dbg('enhanceBookInput called', { userInput: userInput.slice(0, 60), generationMode });

    const isDoge = generationMode === 'blackhole';

    const standardPrompt = `You are an intelligent assistant designed to help users create well-structured learning books.

When a user provides ANY input, analyze it and return a structured JSON response with optimized fields for book creation.

Return ONLY this JSON (no extra text):
{
  "goal": "A clear, specific learning goal (50-150 characters)",
  "title": "An engaging book title",
  "targetAudience": "Specific target audience description",
  "complexityLevel": "beginner | intermediate | advanced",
  "preferences": {
    "includeExamples": true,
    "includePracticalExercises": true,
    "includeQuizzes": false
  },
  "reasoning": "Brief explanation of your choices (optional)"
}

User Input: "${userInput}"`;

    const dogePrompt = `You are a savage, street-smart AI assistant for Blackhole Mode. Take the user's idea and return a high-octane JSON response.

Return ONLY this JSON (no extra text):
{
  "goal": "An aggressive, action-oriented learning goal",
  "title": "A savage, clickbaity book title",
  "targetAudience": "Roast the target audience",
  "complexityLevel": "beginner | intermediate | advanced",
  "preferences": {
    "includeExamples": true,
    "includePracticalExercises": true,
    "includeQuizzes": false
  },
  "reasoning": "A rough, street-smart reason why they need this"
}

User Input: "${userInput}"`;

    const finalPrompt = isDoge ? dogePrompt : standardPrompt;

    try {
      const response = await this.generateWithAI(finalPrompt, undefined, undefined, undefined, 'enhance');
      dbg('enhanceBookInput raw response length:', response.length);

      let cleaned = response.trim()
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '');

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI response was not in a valid JSON format.');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.goal || !parsed.title) throw new Error('AI response is missing required fields.');
      dbg('enhanceBookInput succeeded:', parsed.title);
      return {
        goal: parsed.goal,
        title: parsed.title,
        targetAudience: parsed.targetAudience,
        complexityLevel: parsed.complexityLevel,
        preferences: parsed.preferences,
        reasoning: parsed.reasoning,
      };
    } catch (e) {
      err('enhanceBookInput FAILED:', e);
      throw e; // re-throw so caller can reset isEnhancing
    }
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  private updateProgress(bookId: string, updates: Partial<BookProject>) {
    if (this.onProgressUpdate) {
      this.onProgressUpdate(bookId, { ...updates, updatedAt: new Date() });
    }
  }

  private updateGenerationStatus(bookId: string, status: Partial<GenerationStatus>) {
    if (this.onGenerationStatusUpdate) {
      this.onGenerationStatusUpdate(bookId, status);
    }
  }

  private clearCurrentGeneratedText(bookId: string): void {
    this.currentGeneratedTexts.delete(bookId);
  }

  private saveCheckpoint(
    bookId: string,
    completedModuleIds: string[],
    failedModuleIds: string[],
    lastIndex: number,
    moduleRetryCount: Record<string, number> = {},
    totalWordsGenerated: number = 0
  ) {
    const checkpoint: GenerationCheckpoint = {
      bookId,
      completedModuleIds,
      failedModuleIds,
      moduleRetryCount,
      lastSuccessfulIndex: lastIndex,
      timestamp: new Date().toISOString(),
      totalWordsGenerated,
    };
    this.checkpoints.set(bookId, checkpoint);
    try {
      localStorage.setItem(`checkpoint_${bookId}`, JSON.stringify(checkpoint));
    } catch (error) {
      err('[CHECKPOINT] Failed to save:', error);
    }
  }

  private loadCheckpoint(bookId: string): GenerationCheckpoint | null {
    if (this.checkpoints.has(bookId)) return this.checkpoints.get(bookId)!;
    try {
      const stored = localStorage.getItem(`checkpoint_${bookId}`);
      if (stored) {
        const checkpoint: GenerationCheckpoint = JSON.parse(stored);
        if (!checkpoint.completedModuleIds || !Array.isArray(checkpoint.completedModuleIds)) return null;
        this.checkpoints.set(bookId, checkpoint);
        return checkpoint;
      }
    } catch (error) {
      err('[CHECKPOINT] Failed to load:', error);
    }
    return null;
  }

  private clearCheckpoint(bookId: string) {
    this.checkpoints.delete(bookId);
    try { localStorage.removeItem(`checkpoint_${bookId}`); } catch {}
  }

  pauseGeneration(bookId: string) {
    try { localStorage.setItem(`pause_flag_${bookId}`, 'true'); } catch {}
    this.updateGenerationStatus(bookId, { status: 'paused', totalProgress: 0, logMessage: 'Generation paused by user' });
  }

  resumeGeneration(bookId: string) {
    try { localStorage.removeItem(`pause_flag_${bookId}`); } catch {}
  }

  isPaused(bookId: string): boolean {
    try { return localStorage.getItem(`pause_flag_${bookId}`) === 'true'; } catch { return false; }
  }

  // ============================================================================
  // FIX 1: validateSettings
  // - In proxy mode: auto-correct to zhipu, never push an error
  // - In direct mode: zhipu is proxy-only so skip the key check for it
  // ============================================================================
  validateSettings(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const useProxy = import.meta.env.VITE_USE_PROXY === 'true';

    dbg('validateSettings', {
      useProxy,
      provider: this.settings.selectedProvider,
      model: this.settings.selectedModel,
      VITE_USE_PROXY: import.meta.env.VITE_USE_PROXY,
    });

    if (!this.settings.selectedProvider) errors.push('No AI provider selected');
    if (!this.settings.selectedModel) errors.push('No model selected');

    if (useProxy) {
      // Proxy mode: auto-correct provider, never block on missing API key
      if (this.settings.selectedProvider !== ZHIPU_PROVIDER) {
        dbg('Auto-correcting provider to zhipu for proxy mode');
        this.settings.selectedProvider = ZHIPU_PROVIDER;
        this.settings.selectedModel = DEFAULT_ZHIPU_MODEL;
      }
      // No API key needed — the Edge Function holds it server-side
    } else {
      // Direct mode: zhipu is proxy-only, skip key check for it
      if (this.settings.selectedProvider === ZHIPU_PROVIDER) {
        // Zhipu requires the proxy. Surface a clear error.
        errors.push(
          'Zhipu GLM models require the proxy (VITE_USE_PROXY=true). ' +
          'Set VITE_USE_PROXY=true in your Vercel environment variables and redeploy.'
        );
      } else {
        const apiKey = this.getApiKeyForProvider(this.settings.selectedProvider);
        if (!apiKey) errors.push(`No API key configured for ${this.settings.selectedProvider}`);
      }
    }

    if (errors.length > 0) {
      err('validateSettings FAILED:', errors);
    }

    return { isValid: errors.length === 0, errors };
  }

  private getApiKeyForProvider(provider: string): string | null {
    switch (provider) {
      case 'google':      return this.settings.googleApiKey || null;
      case 'mistral':     return this.settings.mistralApiKey || null;
      case 'groq':        return this.settings.groqApiKey || null;
      case 'cerebras':    return this.settings.cerebrasApiKey || null;
      case 'xai':         return this.settings.xaiApiKey || null;
      case 'openrouter':  return this.settings.openRouterApiKey || null;
      case 'cohere':      return this.settings.cohereApiKey || null;
      // zhipu is proxy-only — no local key
      case 'zhipu':       return null;
      default:            return null;
    }
  }

  private getApiKey(): string {
    const key = this.getApiKeyForProvider(this.settings.selectedProvider);
    if (!key) throw new Error(`${this.settings.selectedProvider} API key not configured`);
    return key;
  }

  private isRateLimitError(error: any): boolean {
    const msg = error?.message?.toLowerCase() || '';
    const status = error?.status || error?.response?.status;
    return status === 429 || status === 503 || status === 529 ||
      msg.includes('rate limit') || msg.includes('quota') ||
      msg.includes('too many requests') || msg.includes('resource exhausted');
  }

  private isSafetyRefusal(text: string): boolean {
    const refusals = [
      'i cannot fulfill this request', 'i am unable to provide', 'i cannot generate',
      'as an ai language model', 'policy against generating', 'offensive or inappropriate',
      'explicit or harmful', 'cannot comply',
    ];
    return refusals.some(r => text.toLowerCase().includes(r)) && text.length < 300;
  }

  private isNetworkError(error: any): boolean {
    const msg = error?.message?.toLowerCase() || '';
    return msg.includes('network') || msg.includes('fetch') || msg.includes('connection') ||
      msg.includes('enotfound') || msg.includes('econnrefused') || error?.name === 'NetworkError';
  }

  private shouldRetryAutomatically(error: any): boolean {
    return this.isRateLimitError(error) || this.isNetworkError(error);
  }

  private shouldRetry(error: any, attempt: number): boolean {
    if (attempt >= this.MAX_MODULE_RETRIES) return false;
    if (this.shouldRetryAutomatically(error)) return true;
    const msg = error?.message?.toLowerCase() || '';
    return ['timeout', 'overloaded', 'unavailable', 'internal error', 'bad gateway'].some(e => msg.includes(e));
  }

  private calculateRetryDelay(attempt: number, isRateLimit: boolean): number {
    const delays = [30000, 40000, 50000, 60000, 70000];
    return delays[Math.min(attempt - 1, delays.length - 1)] + Math.random() * 1000;
  }

  private getProxyTimeoutMs(taskType?: string): number {
    switch (taskType) {
      case 'enhance':
        return 180_000;
      case 'roadmap':
      case 'glossary':
        return 300_000;
      case 'assemble':
        return 420_000;
      case 'module':
      default:
        return 600_000;
    }
  }

  private getProxyModel(taskType?: string): ModelID | undefined {
    switch (taskType) {
      case 'enhance':
      case 'roadmap':
      case 'glossary':
        return undefined;
      case 'assemble':
      case 'module':
      default:
        return this.settings.selectedModel;
    }
  }

  setRetryDecision(bookId: string, decision: 'retry' | 'switch' | 'skip') {
    this.userRetryDecisions.set(bookId, decision);
  }

  private async waitForUserRetryDecision(
    bookId: string, moduleTitle: string, errorMsg: string, retryCount: number
  ): Promise<'retry' | 'switch' | 'skip'> {
    this.updateGenerationStatus(bookId, {
      status: 'waiting_retry',
      totalProgress: 0,
      logMessage: `Error generating: ${moduleTitle}`,
      retryInfo: {
        moduleTitle, error: errorMsg, retryCount,
        maxRetries: this.MAX_MODULE_RETRIES,
        waitTime: this.calculateRetryDelay(retryCount, this.isRateLimitError({ message: errorMsg })),
      },
    });

    return new Promise(resolve => {
      const interval = setInterval(() => {
        const decision = this.userRetryDecisions.get(bookId);
        if (decision) {
          this.userRetryDecisions.delete(bookId);
          clearInterval(interval);
          resolve(decision);
        }
      }, 500);
    });
  }

  // ============================================================================
  // FIX 2: generateWithAI — 90s proxy timeout + full console logging
  // ============================================================================

  private async generateWithAI(
    prompt: string,
    bookId?: string,
    onChunk?: (chunk: string) => void,
    session?: BookSession,
    taskType?: string
  ): Promise<string> {
    const validation = this.validateSettings();
    if (!validation.isValid) {
      const errorMsg = `Configuration error: ${validation.errors.join(', ')}`;
      err('generateWithAI blocked by validation:', errorMsg);
      throw new Error(errorMsg);
    }

    if (!navigator.onLine) {
      err('generateWithAI: no internet connection');
      throw new Error('No internet connection');
    }

    const useProxy = import.meta.env.VITE_USE_PROXY === 'true';
    dbg('generateWithAI', { taskType, useProxy, bookId, provider: this.settings.selectedProvider });

    const requestId = bookId || generateId();
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    // ── Proxy path ──────────────────────────────────────────────────────────
    if (useProxy) {
      dbg('→ taking proxy path');
      let proxyTimeoutId: ReturnType<typeof setTimeout> | null = null;
      const resolvedTask = (taskType as import('./proxyService').TaskType) || 'module';
      const timeoutMs = this.getProxyTimeoutMs(resolvedTask);
      const proxyModel = this.getProxyModel(resolvedTask);

      const timeoutPromise = new Promise<never>((_, reject) => {
        proxyTimeoutId = setTimeout(() => {
          abortController.abort();
          const timeoutSeconds = Math.round(timeoutMs / 1000);
          const msg = `Request timed out after ${timeoutSeconds} seconds. Please try again.`;
          err(`generateWithAI proxy timeout after ${timeoutSeconds}s`);
          reject(new Error(msg));
        }, timeoutMs);
      });

      try {
        const { generateViaProxy } = await import('./proxyService');
        dbg('Calling generateViaProxy with task:', resolvedTask, 'model:', proxyModel || '[server default]');

        const result = await Promise.race([
          generateViaProxy(
            prompt,
            resolvedTask,
            proxyModel,
            abortController.signal,
            onChunk,
            bookId,
          ),
          timeoutPromise,
        ]);

        dbg('generateViaProxy returned', result.length, 'chars');
        return result;
      } catch (proxyError) {
        const msg = proxyError instanceof Error ? proxyError.message : String(proxyError);
        err('generateViaProxy ERROR:', msg);

        if (msg.startsWith('RATE_LIMIT:') || msg.includes('not authenticated')) {
          throw proxyError;
        }
        throw new Error(`Proxy error: ${msg}`);
      } finally {
        if (proxyTimeoutId !== null) clearTimeout(proxyTimeoutId);
        this.activeRequests.delete(requestId);
      }
    }

    // ── Direct provider path ─────────────────────────────────────────────────
    dbg('→ taking direct provider path:', this.settings.selectedProvider);
    const timeoutId = setTimeout(() => {
      abortController.abort();
      this.activeRequests.delete(requestId);
    }, this.requestTimeout);

    try {
      const result = await this.generateWithProvider(prompt, abortController.signal, onChunk);
      return result;
    } finally {
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);
    }
  }

  // ============================================================================
  // PROVIDER METHODS
  // ============================================================================

  private async generateWithProvider(
    prompt: string,
    signal?: AbortSignal,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const { url, headers, body } = this.buildProviderRequest(prompt);

    for (let attempt = 0; attempt < this.MAX_MODULE_RETRIES; attempt++) {
      let response: Response;

      try {
        response = await fetch(url, { method: 'POST', headers, body, signal });
      } catch (fetchErr) {
        err('fetch error (attempt', attempt + 1, '):', fetchErr);
        if ((fetchErr as Error).name === 'AbortError') throw fetchErr;
        if (attempt >= this.MAX_MODULE_RETRIES - 1) throw fetchErr;
        await sleep(this.calculateRetryDelay(attempt + 1, false));
        continue;
      }

      if (response.status === 429 || response.status === 503) {
        if (attempt >= this.MAX_MODULE_RETRIES - 1) {
          throw new Error(`Rate limit exceeded after ${this.MAX_MODULE_RETRIES} attempts`);
        }
        const delay = this.calculateRetryDelay(attempt + 1, true);
        console.warn(`[${this.settings.selectedProvider.toUpperCase()}] Rate limit – retrying in ${Math.round(delay / 1000)}s`);
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})) as Record<string, any>;
        const msg = errData?.error?.message || errData?.message || `HTTP ${response.status}`;
        err('Provider error:', msg);
        throw new Error(msg);
      }

      if (!response.body) throw new Error('Response body is null');

      return await this.readSSEStream(response.body, onChunk);
    }

    throw new Error(`${this.settings.selectedProvider} API failed after retries`);
  }

  private buildProviderRequest(prompt: string): {
    url: string;
    headers: Record<string, string>;
    body: string;
  } {
    const model  = this.settings.selectedModel;
    const apiKey = this.getApiKey();

    const ENDPOINTS: Record<string, string> = {
      google:     `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      mistral:    'https://api.mistral.ai/v1/chat/completions',
      groq:       'https://api.groq.com/openai/v1/chat/completions',
      cerebras:   'https://api.cerebras.ai/v1/chat/completions',
      xai:        'https://api.x.ai/v1/chat/completions',
      openrouter: 'https://openrouter.ai/api/v1/chat/completions',
      cohere:     'https://api.cohere.com/v2/chat',
    };

    const url = ENDPOINTS[this.settings.selectedProvider];
    if (!url) throw new Error(`Unsupported provider: ${this.settings.selectedProvider}`);

    if (this.settings.selectedProvider === 'google') {
      return {
        url,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
        }),
      };
    }

    if (this.settings.selectedProvider === 'cohere') {
      return {
        url,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Client-Name': 'Pustakam AI',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
      };
    }

    const extraHeaders: Record<string, string> = {};
    if (this.settings.selectedProvider === 'openrouter') {
      extraHeaders['HTTP-Referer'] = window.location.origin;
      extraHeaders['X-Title']      = 'Pustakam AI';
    }

    return {
      url,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens:  8192,
        stream:      true,
      }),
    };
  }

  private async readSSEStream(
    body: ReadableStream<Uint8Array>,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const reader  = body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer      = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;

        try {
          const data = JSON.parse(trimmed.slice(6));
          const oaiText    = data?.choices?.[0]?.delta?.content || '';
          const googleText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cohereText = data?.type === 'content-delta'
            ? (data?.delta?.message?.content?.text || '')
            : '';
          const text = oaiText || googleText || cohereText;
          if (text) {
            fullContent += text;
            onChunk?.(text);
          }
        } catch {
          // Ignore partial JSON frames
        }
      }
    }

    if (!fullContent) throw new Error('No content generated');
    return fullContent;
  }

  // ============================================================================
  // ROADMAP GENERATION
  // ============================================================================

  async generateRoadmap(session: BookSession, bookId: string): Promise<BookRoadmap> {
    dbg('generateRoadmap start', bookId);
    try {
      localStorage.removeItem(`pause_flag_${bookId}`);
      localStorage.removeItem(`checkpoint_${bookId}`);
    } catch {}

    this.updateProgress(bookId, { status: 'generating_roadmap', progress: 5 });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const prompt  = this.buildRoadmapPrompt(session);
        const response = await this.generateWithAI(prompt, bookId, undefined, session, 'roadmap');
        const roadmap  = await this.parseRoadmapResponse(response, session);

        planService.incrementBooksCreated().catch(() => {});
        this.updateProgress(bookId, { status: 'roadmap_completed', progress: 10, roadmap });
        dbg('generateRoadmap success', roadmap.totalModules, 'modules');
        return roadmap;
      } catch (e) {
        err('generateRoadmap attempt', attempt + 1, 'failed:', e);
        if (attempt >= 1) {
          this.updateProgress(bookId, { status: 'error', error: 'Roadmap generation failed' });
          throw e;
        }
        await sleep(2000);
      }
    }
    throw new Error('Roadmap generation failed');
  }

  private buildRoadmapPrompt(session: BookSession): string {
    if (session.generationMode === 'blackhole') {
      if (session.language === 'hi' || session.language === 'mr') {
        return desiPromptService.buildRoadmapPrompt(session);
      }
      return streetPromptService.buildRoadmapPrompt(session);
    }

    const reasoningPrompt = session.reasoning ? `\n- Reasoning: ${session.reasoning}` : '';

    return `Create a comprehensive learning roadmap for: "${session.goal}"

Requirements:
- Generate a minimum of 8 modules based on complexity and scope
- Each module should have a clear title and 3-5 specific learning objectives
- Estimate realistic reading/study time for each module
- Target audience: ${session.targetAudience || 'general learners'}
- Complexity: ${session.complexityLevel || 'intermediate'}${reasoningPrompt}

Return ONLY valid JSON:
{
  "modules": [
    {
      "title": "Module Title",
      "objectives": ["Objective 1", "Objective 2"],
      "estimatedTime": "2-3 hours"
    }
  ],
  "estimatedReadingTime": "20-25 hours",
  "difficultyLevel": "intermediate"
}`;
  }

  private async parseRoadmapResponse(response: string, session: BookSession): Promise<BookRoadmap> {
    const cleaned = response.trim()
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/^[^{]*/, '')
      .replace(/[^}]*$/, '');

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid response format');

    const roadmap = JSON.parse(jsonMatch[0]);
    if (!roadmap.modules || !Array.isArray(roadmap.modules)) throw new Error('Invalid roadmap: missing modules array');

    roadmap.modules = roadmap.modules.map((module: any, index: number) => ({
      id: `module_${index + 1}`,
      title: module.title?.trim() || `Module ${index + 1}`,
      objectives: Array.isArray(module.objectives) ? module.objectives : [`Learn ${module.title}`],
      estimatedTime: module.estimatedTime || '1-2 hours',
      order: index + 1,
    }));

    roadmap.totalModules       = roadmap.modules.length;
    roadmap.estimatedReadingTime = roadmap.estimatedReadingTime || `${roadmap.modules.length * 2} hours`;
    roadmap.difficultyLevel    = roadmap.difficultyLevel || session.complexityLevel || 'intermediate';

    return roadmap;
  }

  // ============================================================================
  // MODULE GENERATION
  // ============================================================================

  async generateModuleContentWithRetry(
    book: BookProject,
    roadmapModule: RoadmapModule,
    session: BookSession,
    attemptNumber: number = 1
  ): Promise<BookModule> {
    if (this.isPaused(book.id)) throw new Error('GENERATION_PAUSED');

    const totalWordsBefore = book.modules.reduce((sum, m) => sum + (m.status === 'completed' ? m.wordCount : 0), 0);
    this.currentGeneratedTexts.set(book.id, '');

    this.updateGenerationStatus(book.id, {
      currentModule: { id: roadmapModule.id, title: roadmapModule.title, attempt: attemptNumber, progress: 0, generatedText: '' },
      totalProgress: 0,
      status: 'generating',
      logMessage: `Starting: ${roadmapModule.title}`,
      totalWordsGenerated: totalWordsBefore,
      aiStage: 'analyzing',
    });

    try {
      const previousModules = book.modules.filter(m => m.status === 'completed');
      const prompt = this.buildModulePrompt(
        session, roadmapModule, previousModules,
        previousModules.length === 0, roadmapModule.order, book.roadmap?.totalModules || 0
      );

      const moduleContent = await this.generateWithAI(prompt, book.id, (chunk) => {
        if (this.isPaused(book.id)) {
          this.activeRequests.get(book.id)?.abort();
          return;
        }
        const currentText = (this.currentGeneratedTexts.get(book.id) || '') + chunk;
        this.currentGeneratedTexts.set(book.id, currentText);
        const wordCount = currentText.split(/\s+/).filter(w => w.length > 0).length;

        this.updateGenerationStatus(book.id, {
          currentModule: {
            id: roadmapModule.id, title: roadmapModule.title,
            attempt: attemptNumber, progress: Math.min(95, (wordCount / 3000) * 100),
            generatedText: currentText.slice(-800),
          },
          totalProgress: 0,
          status: 'generating',
          totalWordsGenerated: totalWordsBefore + wordCount,
        });
      }, session, 'module');

      const wordCount = moduleContent.split(/\s+/).filter(Boolean).length;

      if (this.isSafetyRefusal(moduleContent)) {
        throw new Error('AI_SAFETY_REFUSAL: The model refused to generate this content.');
      }
      if (wordCount < 150) {
        throw new Error(`Generated content too short (${wordCount} words).`);
      }

      this.currentGeneratedTexts.delete(book.id);
      this.updateGenerationStatus(book.id, { logMessage: `✓ Completed: ${roadmapModule.title}`, aiStage: 'complete' });

      return {
        id: generateId(), roadmapModuleId: roadmapModule.id, title: roadmapModule.title,
        content: moduleContent.trim(), wordCount, status: 'completed', generatedAt: new Date(),
      };

    } catch (error) {
      if (error instanceof Error && error.message === 'GENERATION_PAUSED') throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      err('Module generation error:', errorMessage);

      if (attemptNumber < this.MAX_MODULE_RETRIES && this.shouldRetryAutomatically(error)) {
        const delay = this.calculateRetryDelay(attemptNumber, this.isRateLimitError(error));
        this.updateGenerationStatus(book.id, {
          status: 'generating',
          logMessage: `⏳ Auto-retrying in ${Math.round(delay / 1000)}s…`,
        });
        await sleep(delay);
        return this.generateModuleContentWithRetry(book, roadmapModule, session, attemptNumber + 1);
      }

      if (attemptNumber < this.MAX_MODULE_RETRIES && this.shouldRetry(error, attemptNumber)) {
        const decision = await this.waitForUserRetryDecision(book.id, roadmapModule.title, errorMessage, attemptNumber);
        if (decision === 'retry') {
          return this.generateModuleContentWithRetry(book, roadmapModule, session, attemptNumber + 1);
        } else if (decision === 'switch' || errorMessage.includes('AI_SAFETY_REFUSAL')) {
          throw new Error('USER_REQUESTED_MODEL_SWITCH');
        } else {
          return { id: generateId(), roadmapModuleId: roadmapModule.id, title: roadmapModule.title, content: '', wordCount: 0, status: 'error', error: `Skipped: ${errorMessage}`, generatedAt: new Date() };
        }
      }

      this.updateGenerationStatus(book.id, { status: 'error', logMessage: `✗ Failed: ${roadmapModule.title}` });
      return { id: generateId(), roadmapModuleId: roadmapModule.id, title: roadmapModule.title, content: '', wordCount: 0, status: 'error', error: errorMessage, generatedAt: new Date() };
    }
  }

  private buildModulePrompt(
    session: BookSession, roadmapModule: RoadmapModule, previousModules: BookModule[],
    isFirstModule: boolean, moduleIndex: number, totalModules: number
  ): string {
    if (session.generationMode === 'blackhole') {
      if (session.language === 'hi' || session.language === 'mr') {
        return desiPromptService.buildModulePrompt(session, roadmapModule, previousModules, isFirstModule, moduleIndex, totalModules);
      }
      return streetPromptService.buildModulePrompt(session, roadmapModule, previousModules, isFirstModule, moduleIndex, totalModules);
    }

    const contextSummary = !isFirstModule && previousModules.length > 0
      ? `\n\nPREVIOUS MODULES:\n${previousModules.slice(-2).map(m => `${m.title}: ${m.content.substring(0, 300)}…`).join('\n\n')}`
      : '';
    const reasoningPrompt = session.reasoning ? `\n- Reasoning: ${session.reasoning}` : '';

    return `Generate a comprehensive chapter for: "${roadmapModule.title}"

CONTEXT:
- Learning Goal: ${session.goal}
- Module ${moduleIndex} of ${totalModules}
- Objectives: ${roadmapModule.objectives.join(', ')}
- Audience: ${session.targetAudience || 'general learners'}
- Complexity: ${session.complexityLevel || 'intermediate'}${reasoningPrompt}${contextSummary}

REQUIREMENTS:
- Write 2000-4000 words
- ${isFirstModule ? 'Provide introduction' : 'Build upon previous content'}
- Use ## markdown headers
- Include bullet points and lists
${session.preferences?.includeExamples ? '- Include practical examples' : ''}
${session.preferences?.includePracticalExercises ? '- Add exercises at the end' : ''}

STRUCTURE:
## ${roadmapModule.title}
### Introduction
### Core Concepts
### Practical Application
${session.preferences?.includePracticalExercises ? '### Practice Exercises' : ''}
### Key Takeaways`;
  }

  // ============================================================================
  // ORCHESTRATION
  // ============================================================================

  async generateAllModulesWithRecovery(book: BookProject, session: BookSession): Promise<void> {
    if (!book.roadmap) throw new Error('No roadmap available');

    this.resumeGeneration(book.id);

    const checkpoint = this.loadCheckpoint(book.id);
    let completedModules   = [...book.modules.filter(m => m.status === 'completed')];
    const completedIds     = new Set<string>(completedModules.map(m => m.roadmapModuleId).filter(Boolean));
    const failedIds        = new Set<string>();
    const moduleRetryCount: Record<string, number> = {};

    if (checkpoint) {
      checkpoint.completedModuleIds.forEach(id => completedIds.add(id));
      checkpoint.failedModuleIds.forEach(id => failedIds.add(id));
      Object.assign(moduleRetryCount, checkpoint.moduleRetryCount || {});
    }

    const modulesToGenerate = book.roadmap.modules.filter(m => !completedIds.has(m.id));
    if (modulesToGenerate.length === 0) {
      this.updateProgress(book.id, { status: 'roadmap_completed', progress: 90, modules: completedModules });
      return;
    }

    this.updateProgress(book.id, { status: 'generating_content', progress: 15 });

    for (let i = 0; i < modulesToGenerate.length; i++) {
      const roadmapModule = modulesToGenerate[i];

      if (this.isPaused(book.id)) {
        this.saveCheckpoint(book.id, Array.from(completedIds), Array.from(failedIds), i - 1, moduleRetryCount,
          completedModules.reduce((s, m) => s + (m.status === 'completed' ? m.wordCount : 0), 0));
        this.updateProgress(book.id, { status: 'generating_content', modules: [...completedModules], progress: 15 + (completedModules.length / book.roadmap.modules.length) * 70 });
        this.updateGenerationStatus(book.id, { status: 'paused', totalProgress: 0, logMessage: 'Generation paused — progress saved' });
        return;
      }

      this.clearCurrentGeneratedText(book.id);

      try {
        const newModule = await this.generateModuleContentWithRetry(
          { ...book, modules: completedModules }, roadmapModule, session,
          (moduleRetryCount[roadmapModule.id] || 0) + 1
        );

        if (this.isPaused(book.id)) {
          if (newModule.status === 'completed') { completedModules.push(newModule); completedIds.add(roadmapModule.id); }
          this.saveCheckpoint(book.id, Array.from(completedIds), Array.from(failedIds), i, moduleRetryCount,
            completedModules.reduce((s, m) => s + (m.status === 'completed' ? m.wordCount : 0), 0));
          this.updateProgress(book.id, { status: 'generating_content', modules: [...completedModules] });
          this.updateGenerationStatus(book.id, { status: 'paused', totalProgress: 0, logMessage: 'Generation paused — progress saved' });
          return;
        }

        if (newModule.status === 'completed') {
          completedModules.push(newModule);
          completedIds.add(roadmapModule.id);
          failedIds.delete(roadmapModule.id);
          delete moduleRetryCount[roadmapModule.id];

          const totalWords = completedModules.reduce((s, m) => s + (m.status === 'completed' ? m.wordCount : 0), 0);
          this.saveCheckpoint(book.id, Array.from(completedIds), Array.from(failedIds), i, moduleRetryCount, totalWords);
          this.updateProgress(book.id, { modules: [...completedModules], progress: Math.min(85, 15 + (completedModules.length / book.roadmap.modules.length) * 70) });
        } else {
          failedIds.add(roadmapModule.id);
          completedModules.push(newModule);
          this.saveCheckpoint(book.id, Array.from(completedIds), Array.from(failedIds), i, moduleRetryCount,
            completedModules.reduce((s, m) => s + (m.status === 'completed' ? m.wordCount : 0), 0));
          this.updateProgress(book.id, { modules: [...completedModules], status: 'error', error: `Failed: ${roadmapModule.title}` });
          this.updateGenerationStatus(book.id, { status: 'error', totalProgress: (completedIds.size / book.roadmap.modules.length) * 100, logMessage: `✗ Stopped: ${roadmapModule.title}` });
          return;
        }

        if (i < modulesToGenerate.length - 1) await sleep(1000);

      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'GENERATION_PAUSED' || error.message === 'USER_REQUESTED_MODEL_SWITCH') {
            this.saveCheckpoint(book.id, Array.from(completedIds), Array.from(failedIds), i, moduleRetryCount,
              completedModules.reduce((s, m) => s + (m.status === 'completed' ? m.wordCount : 0), 0));
            this.updateProgress(book.id, { status: 'generating_content', modules: [...completedModules] });
            this.updateGenerationStatus(book.id, { status: 'paused', totalProgress: 0, logMessage: error.message === 'GENERATION_PAUSED' ? 'Generation paused' : 'Waiting for model switch' });
            return;
          }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        err('generateAllModulesWithRecovery loop error:', errorMessage);
        failedIds.add(roadmapModule.id);
        moduleRetryCount[roadmapModule.id] = (moduleRetryCount[roadmapModule.id] || 0) + 1;
        this.saveCheckpoint(book.id, Array.from(completedIds), Array.from(failedIds), i, moduleRetryCount,
          completedModules.reduce((s, m) => s + (m.status === 'completed' ? m.wordCount : 0), 0));
        completedModules.push({ id: generateId(), roadmapModuleId: roadmapModule.id, title: roadmapModule.title, content: '', wordCount: 0, status: 'error', error: errorMessage, generatedAt: new Date() });
        this.updateProgress(book.id, { modules: [...completedModules], status: 'error', error: `Failed: ${roadmapModule.title}` });
        this.updateGenerationStatus(book.id, { status: 'error', totalProgress: (completedIds.size / book.roadmap.modules.length) * 100, logMessage: `✗ Stopped: ${roadmapModule.title}` });
        return;
      }
    }

    this.clearCheckpoint(book.id);
    try { localStorage.removeItem(`pause_flag_${book.id}`); } catch {}

    this.updateProgress(book.id, { status: 'roadmap_completed', modules: completedModules, progress: 90 });
    this.updateGenerationStatus(book.id, { status: 'completed', totalProgress: 100, logMessage: 'All modules generated successfully' });

    const totalWords = completedModules.reduce((s, m) => s + m.wordCount, 0);
    planService.recordBookCompleted(book.id, book.title || session.goal.slice(0, 50), session.goal, session.generationMode || 'stellar', book.roadmap?.totalModules || completedModules.length, totalWords).catch(() => {});
  }

  async retryFailedModules(book: BookProject, session: BookSession): Promise<void> {
    if (!book.roadmap) throw new Error('No roadmap available');

    const failedModules = book.modules.filter(m => m.status === 'error');
    if (failedModules.length === 0) return;

    this.resumeGeneration(book.id);
    const completedModules = [...book.modules.filter(m => m.status === 'completed')];

    for (const failedModule of failedModules) {
      if (this.isPaused(book.id)) {
        this.updateProgress(book.id, { modules: [...completedModules], status: 'error', error: 'Retry paused' });
        return;
      }

      const roadmapModule = book.roadmap.modules.find(rm => rm.id === failedModule.roadmapModuleId);
      if (!roadmapModule) continue;

      try {
        const newModule = await this.generateModuleContentWithRetry({ ...book, modules: completedModules }, roadmapModule, session);
        if (this.isPaused(book.id)) {
          completedModules.push(newModule);
          this.updateProgress(book.id, { modules: [...completedModules], status: 'error', error: 'Retry paused' });
          return;
        }
        completedModules.push(newModule);
        this.updateProgress(book.id, { modules: [...completedModules] });
        await sleep(1000);
      } catch (error) {
        if (error instanceof Error && error.message === 'GENERATION_PAUSED') {
          this.updateProgress(book.id, { modules: [...completedModules], status: 'error', error: 'Retry paused' });
          return;
        }
      }
    }

    const stillFailed = completedModules.filter(m => m.status === 'error').length;
    if (stillFailed === 0) {
      this.clearCheckpoint(book.id);
      this.updateProgress(book.id, { status: 'roadmap_completed', modules: completedModules, progress: 90 });
    } else {
      this.updateProgress(book.id, { status: 'error', error: `${stillFailed} module(s) still failed`, modules: completedModules });
    }
  }

  // ============================================================================
  // BOOK ASSEMBLY
  // ============================================================================

  async assembleFinalBook(book: BookProject, session: BookSession): Promise<void> {
    this.updateProgress(book.id, { status: 'assembling', progress: 90 });

    try {
      const [introduction, summary, glossary] = await Promise.all([
        this.generateBookIntroduction(session, book.roadmap!),
        this.generateBookSummary(session, book.modules),
        this.generateGlossary(book.modules),
      ]);

      const totalWords   = book.modules.reduce((s, m) => s + m.wordCount, 0);
      const modelName    = this.settings.selectedModel;
      const providerName = this.getProviderDisplayName();

      const finalBook = [
        `# ${book.title}\n`,
        `**Generated:** ${new Date().toLocaleDateString()}\n`,
        `**Words:** ${totalWords.toLocaleString()}\n`,
        `**Provider:** ${providerName} (${modelName})\n\n`,
        `---\n\n## Table of Contents\n`,
        this.generateTableOfContents(book.modules),
        `\n\n---\n\n## Introduction\n\n${introduction}\n\n---\n\n`,
        ...book.modules.map((m, i) => `${m.content}\n\n${i < book.modules.length - 1 ? '---\n\n' : ''}`),
        `\n---\n\n## Summary\n\n${summary}\n\n---\n\n`,
        `## Glossary\n\n${glossary}`,
      ].join('');

      this.clearCheckpoint(book.id);
      try { localStorage.removeItem(`pause_flag_${book.id}`); } catch {}

      this.updateProgress(book.id, { status: 'completed', progress: 100, finalBook, totalWords });
    } catch (error) {
      err('assembleFinalBook failed:', error);
      this.updateProgress(book.id, { status: 'error', error: 'Book assembly failed' });
      throw error;
    }
  }

  private getProviderDisplayName(): string {
    const names: Record<string, string> = {
      zhipu: AI_SUITE_NAME, google: 'Google Gemini', mistral: 'Mistral AI',
      xai: 'xAI', groq: 'Groq', cerebras: 'Cerebras', openrouter: 'OpenRouter', cohere: 'Cohere',
    };
    return names[this.settings.selectedProvider] || 'AI';
  }

  private generateTableOfContents(modules: BookModule[]): string {
    return modules.map((m, i) => `${i + 1}. [${m.title}](#${m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`).join('\n');
  }

  private async generateBookIntroduction(session: BookSession, roadmap: BookRoadmap): Promise<string> {
    const prompt = `Generate a compelling introduction for: "${session.goal}"

ROADMAP:
${roadmap.modules.map(m => `- ${m.title}`).join('\n')}

TARGET: ${session.targetAudience || 'general learners'}
LEVEL: ${roadmap.difficultyLevel}

Write 800-1200 words covering: welcome and purpose, what readers will learn, book structure, motivation. Use ## markdown headers.`;
    return await this.generateWithAI(prompt, undefined, undefined, session, 'assemble');
  }

  private async generateBookSummary(session: BookSession, modules: BookModule[]): Promise<string> {
    const prompt = `Generate a summary for: "${session.goal}"

MODULES:
${modules.map(m => `- ${m.title}`).join('\n')}

Write 600-900 words covering: key learning outcomes, important concepts recap, next steps, congratulations.`;
    return await this.generateWithAI(prompt, undefined, undefined, session, 'assemble');
  }

  private async generateGlossary(modules: BookModule[]): Promise<string> {
    const content = modules.map(m => m.content).join('\n\n').substring(0, 12000);
    const prompt  = `Extract key terms from this content and create a glossary:
${content}

Create 20-30 terms with clear 1-2 sentence definitions, alphabetical order.

Format:
**Term**: Definition.`;
    return await this.generateWithAI(prompt, undefined, undefined, undefined, 'glossary');
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  downloadAsMarkdown(project: BookProject): void {
    if (!project.finalBook) throw new Error('No book content available');
    const blob     = new Blob([project.finalBook], { type: 'text/markdown;charset=utf-8' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const safeTitle = project.title.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_').toLowerCase().substring(0, 50);
    a.href         = url;
    a.download     = `${safeTitle}_${new Date().toISOString().slice(0, 10)}_book.md`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  cancelActiveRequests(bookId?: string): void {
    if (bookId) {
      this.activeRequests.get(bookId)?.abort();
      this.activeRequests.delete(bookId);
      this.pauseGeneration(bookId);
    } else {
      this.activeRequests.forEach(c => c.abort());
      this.activeRequests.clear();
    }
  }

  hasCheckpoint(bookId: string): boolean {
    return this.checkpoints.has(bookId) || localStorage.getItem(`checkpoint_${bookId}`) !== null;
  }

  getCheckpointInfo(bookId: string): { completed: number; failed: number; total: number; lastSaved: string } | null {
    const cp = this.loadCheckpoint(bookId);
    if (!cp) return null;
    const completed = Array.isArray(cp.completedModuleIds) ? cp.completedModuleIds.length : 0;
    const failed    = Array.isArray(cp.failedModuleIds) ? cp.failedModuleIds.length : 0;
    return { completed, failed, total: completed + failed, lastSaved: new Date(cp.timestamp).toLocaleString() };
  }
}

export const bookService = new BookGenerationService();
