// src/services/proxyService.ts
import { supabase } from '../lib/supabaseClient';
import { ModelID } from '../types';

const PROXY_URL = '/api/ai';

export type TaskType = 'roadmap' | 'module' | 'enhance' | 'assemble' | 'glossary';

export async function generateViaProxy(
  prompt: string,
  taskType: TaskType,
  model?: ModelID,
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
        ...(model ? { model } : {}),
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

  const processFrame = (frame: string) => {
    const trimmedFrame = frame.trim();
    if (!trimmedFrame || trimmedFrame.startsWith(':')) return;

    let eventType = 'message';
    const dataParts: string[] = [];

    for (const line of trimmedFrame.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith(':')) continue;
      if (trimmedLine.startsWith('event:')) {
        eventType = trimmedLine.slice(6).trim() || 'message';
        continue;
      }
      if (trimmedLine.startsWith('data:')) {
        dataParts.push(trimmedLine.slice(5).trimStart());
      }
    }

    if (dataParts.length === 0) return;

    const payload = dataParts.join('\n');
    if (payload === '[DONE]') return;

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }

    const streamError = typeof parsed?.error === 'string' ? parsed.error : null;
    if (eventType === 'error' || streamError) {
      throw new Error(streamError || 'Proxy stream failed');
    }

    const content = (parsed?.choices as Array<{ delta?: { content?: string } }> | undefined)?.[0]?.delta?.content || '';
    if (content) {
      fullContent += content;
      onChunk?.(content);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';

    for (const frame of frames) {
      processFrame(frame);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const frames = buffer.split('\n\n');
    for (const frame of frames) {
      processFrame(frame);
    }
  }

  if (!fullContent) {
    throw new Error('Proxy returned empty content');
  }

  return fullContent;
}
