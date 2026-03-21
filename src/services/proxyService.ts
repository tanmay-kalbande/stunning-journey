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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const response = await fetch(PROXY_URL, {
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

  if (response.status === 429) {
    const err = await response.json();
    throw new Error(`RATE_LIMIT: ${err.error}`);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Proxy error ${response.status}: ${err.error}`);
  }

  if (!response.body) {
    throw new Error('Empty response stream');
  }

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
        // Ignore partial SSE chunks until the next read completes the payload.
      }
    }
  }

  if (!fullContent) {
    throw new Error('Proxy returned empty content');
  }

  return fullContent;
}
