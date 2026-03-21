// src/services/proxyService.ts
import { supabase } from '../lib/supabaseClient';
import { ModelID } from '../types';

const PROXY_URL = '/api/ai';

export type TaskType = 'roadmap' | 'module' | 'enhance' | 'assemble' | 'glossary';

export async function generateViaProxy(
  prompt: string,
  taskType: TaskType,
  model: ModelID,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void,
  bookId?: string
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Proxy auth cannot start.');
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      signal,
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        task_type: taskType,
        model,
        book_id: bookId || null,
        stream: true,
      }),
    });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error('[ProxyService] fetch failed:', msg);
    throw new Error(`Network error calling proxy: ${msg}`);
  }

  // ── Parse error responses — try JSON first, fall back to text ────────────
  if (!response.ok) {
    // Try to read the body as text so we always get SOMETHING useful
    let rawBody = '';
    try {
      rawBody = await response.text();
    } catch {
      rawBody = '(could not read response body)';
    }

    // Log the full body so it shows in DevTools console
    console.error(
      `[ProxyService] ${response.status} response from /api/ai:\n`,
      rawBody.slice(0, 2000) // cap at 2k chars
    );

    // Try to extract a structured error message
    let errorMsg = rawBody;
    try {
      const parsed = JSON.parse(rawBody);
      errorMsg = parsed?.error || parsed?.message || rawBody;
    } catch {
      // rawBody is HTML or plain text — use as-is (trimmed)
      errorMsg = rawBody.slice(0, 300);
    }

    if (response.status === 429) {
      throw new Error(`RATE_LIMIT: ${errorMsg}`);
    }

    throw new Error(`Proxy ${response.status}: ${errorMsg}`);
  }

  if (!response.body) {
    throw new Error('Empty response stream from proxy');
  }

  // ── Stream SSE ────────────────────────────────────────────────────────────
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') continue;

      try {
        const data = JSON.parse(jsonStr);
        const content = data?.choices?.[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk?.(content);
        }
      } catch {
        // Ignore partial SSE frames
      }
    }
  }

  if (!fullContent) {
    throw new Error('Proxy returned empty content');
  }

  return fullContent;
}
