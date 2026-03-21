// api/ai.ts — Vercel Edge Function (no timeout, full streaming)
export const runtime = 'edge';

type TaskType = 'roadmap' | 'module' | 'enhance' | 'assemble' | 'glossary';

const ALLOWED_MODELS = ['glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.7-flashx'] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];

const TASK_DEFAULT_MODELS: Record<TaskType, AllowedModel> = {
  roadmap:  'glm-5-turbo',
  module:   'glm-5',
  enhance:  'glm-4.7-flashx',
  assemble: 'glm-4.7',
  glossary: 'glm-4.7-flashx',
};

const MODEL_PRICING: Record<AllowedModel, { input: number; output: number }> = {
  'glm-5':          { input: 0, output: 0 },
  'glm-5-turbo':    { input: 0, output: 0 },
  'glm-4.7':        { input: 0, output: 0 },
  'glm-4.7-flashx': { input: 0, output: 0 },
};

const DAILY_LIMITS = { requests: 100, tokens: 200000, books: 5 };
const GLOBAL_DAILY_BUDGET_USD = 20;
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function resolveModel(taskType: TaskType, requestedModel?: string): AllowedModel {
  if (requestedModel && ALLOWED_MODELS.includes(requestedModel as AllowedModel)) {
    return requestedModel as AllowedModel;
  }
  return TASK_DEFAULT_MODELS[taskType];
}

async function supabaseRequest(
  url: string,
  method: string,
  body: object | null,
  serviceKey: string,
  extraHeaders?: Record<string, string>
) {
  return fetch(url, {
    method,
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${serviceKey}`,
      apikey:          serviceKey,
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function logUsage(
  supabaseUrl: string,
  serviceRoleKey: string,
  params: {
    userId: string; taskType: string; model: string;
    promptTokens: number; outputTokens: number; totalTokens: number;
    costCents: number; wordCount: number; bookId: string | null;
    success: boolean; errorMessage: string | null; durationMs: number;
  }
) {
  try {
    await supabaseRequest(`${supabaseUrl}/rest/v1/ai_usage`, 'POST', {
      user_id:        params.userId,
      task_type:      params.taskType,
      model_used:     params.model,
      prompt_tokens:  params.promptTokens,
      output_tokens:  params.outputTokens,
      total_tokens:   params.totalTokens,
      cost_usd_cents: params.costCents,
      word_count:     params.wordCount,
      book_id:        params.bookId,
      success:        params.success,
      error_message:  params.errorMessage,
      duration_ms:    params.durationMs,
    }, serviceRoleKey);
  } catch (e) {
    console.error('[ai/api] logUsage failed (non-fatal):', e);
  }
}

async function incrementRateLimit(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  date: string,
  tokens: number,
  newBook: boolean
) {
  try {
    await supabaseRequest(
      `${supabaseUrl}/rest/v1/rpc/increment_rate_limit`,
      'POST',
      { p_user_id: userId, p_date: date, p_tokens: tokens, p_new_book: newBook },
      serviceRoleKey
    );
  } catch (e) {
    console.error('[ai/api] incrementRateLimit failed (non-fatal):', e);
  }
}

// ── main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  // Wrap everything — FUNCTION_INVOCATION_FAILED can never happen again
  try {
    return await _handler(req);
  } catch (fatal: unknown) {
    const msg = fatal instanceof Error ? fatal.message : String(fatal);
    console.error('[ai/api] FATAL unhandled error:', msg);
    return errorResponse(500, `Internal server error: ${msg}`);
  }
}

async function _handler(req: Request): Promise<Response> {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  // ── Env var check — return a clear error, never crash ────────────────────
  const ZHIPU_API_KEY          = process.env.ZHIPU_API_KEY;
  const SUPABASE_URL           = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY      = process.env.SUPABASE_ANON_KEY;
  const SERVICE_ROLE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Debug: log which vars are present (values masked)
  console.log('[ai/api] env check:', {
    ZHIPU_API_KEY:          !!ZHIPU_API_KEY,
    SUPABASE_URL:           !!SUPABASE_URL,
    SUPABASE_ANON_KEY:      !!SUPABASE_ANON_KEY,
    SERVICE_ROLE_KEY:       !!SERVICE_ROLE_KEY,
  });

  const missing: string[] = [];
  if (!ZHIPU_API_KEY)     missing.push('ZHIPU_API_KEY');
  if (!SUPABASE_URL)      missing.push('SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!SERVICE_ROLE_KEY)  missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    const msg = `Missing server env vars: ${missing.join(', ')}. Add them in Vercel → Settings → Environment Variables and redeploy.`;
    console.error('[ai/api]', msg);
    return errorResponse(500, msg);
  }

  const startTime = Date.now();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Missing Authorization header. Please sign in.');
  }
  const userJwt = authHeader.replace('Bearer ', '');

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${userJwt}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (!userRes.ok) {
    return errorResponse(401, 'Invalid session. Please sign in again.');
  }

  const userData = await userRes.json() as { id?: string };
  const userId = userData.id;
  if (!userId) {
    return errorResponse(401, 'Could not identify user from token.');
  }

  // ── Global budget check ───────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  const spendRes = await supabaseRequest(
    `${SUPABASE_URL}/rest/v1/ai_usage?created_at=gte.${today}T00:00:00Z&select=cost_usd_cents`,
    'GET', null, SERVICE_ROLE_KEY
  );
  const spendData: Array<{ cost_usd_cents?: number }> = spendRes.ok ? await spendRes.json() : [];
  const todaySpend = spendData.reduce((s, r) => s + (r.cost_usd_cents || 0), 0) / 100;

  if (todaySpend >= GLOBAL_DAILY_BUDGET_USD) {
    return errorResponse(503, 'Platform is at capacity for today. Try again tomorrow.');
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    messages:    Array<{ role: string; content: string }>;
    task_type?:  TaskType;
    model?:      string;
    book_id?:    string | null;
    max_tokens?: number;
  };

  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  if (!body.messages?.length) {
    return errorResponse(400, 'messages array is required');
  }

  const taskType     = body.task_type || 'module';
  const bookId       = body.book_id   || null;
  const resolvedModel = resolveModel(taskType, body.model);

  // ── Rate limit check ──────────────────────────────────────────────────────
  const rlRes = await supabaseRequest(
    `${SUPABASE_URL}/rest/v1/rate_limits?user_id=eq.${userId}&date=eq.${today}&select=id,requests_made,tokens_used,books_started`,
    'GET', null, SERVICE_ROLE_KEY
  );
  const rlData: Array<{ requests_made: number; tokens_used: number; books_started: number }> =
    rlRes.ok ? await rlRes.json() : [];
  const current = rlData[0] || { requests_made: 0, tokens_used: 0, books_started: 0 };

  if (current.requests_made >= DAILY_LIMITS.requests) {
    return errorResponse(429, `Daily limit: ${DAILY_LIMITS.requests} requests/day. Resets at midnight UTC.`);
  }
  if (current.tokens_used >= DAILY_LIMITS.tokens) {
    return errorResponse(429, 'Daily token limit reached. Resets at midnight UTC.');
  }
  const isNewBook = taskType === 'roadmap';
  if (isNewBook && current.books_started >= DAILY_LIMITS.books) {
    return errorResponse(429, `Daily book limit: ${DAILY_LIMITS.books} books/day. Resets at midnight UTC.`);
  }

  // ── Call Zhipu ────────────────────────────────────────────────────────────
  const zhipuPayload = {
    model:          resolvedModel,
    messages:       body.messages,
    stream:         true,
    max_tokens:     body.max_tokens || (taskType === 'module' ? 8192 : 4096),
    temperature:    0.7,
    stream_options: { include_usage: true },
  };

  let zhipuRes: Response;
  try {
    zhipuRes = await fetch(ZHIPU_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify(zhipuPayload),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error('[ai/api] Zhipu network error:', msg);
    await logUsage(SUPABASE_URL, SERVICE_ROLE_KEY, {
      userId, taskType, model: resolvedModel,
      promptTokens: 0, outputTokens: 0, totalTokens: 0,
      costCents: 0, wordCount: 0, bookId,
      success: false, errorMessage: `Network: ${msg}`,
      durationMs: Date.now() - startTime,
    });
    return errorResponse(502, 'Failed to reach AI provider');
  }

  if (!zhipuRes.ok) {
    const errText = await zhipuRes.text().catch(() => zhipuRes.statusText);
    console.error('[ai/api] Zhipu error:', zhipuRes.status, errText);
    await logUsage(SUPABASE_URL, SERVICE_ROLE_KEY, {
      userId, taskType, model: resolvedModel,
      promptTokens: 0, outputTokens: 0, totalTokens: 0,
      costCents: 0, wordCount: 0, bookId,
      success: false, errorMessage: `Zhipu ${zhipuRes.status}: ${errText}`,
      durationMs: Date.now() - startTime,
    });
    return errorResponse(zhipuRes.status, `AI provider error (${zhipuRes.status}): ${errText}`);
  }

  if (!zhipuRes.body) {
    return errorResponse(502, 'Empty response from AI provider');
  }

  // ── Stream through, counting tokens ──────────────────────────────────────
  let outputTokens = 0;
  let promptTokens = 0;
  let wordCount    = 0;
  const pricing    = MODEL_PRICING[resolvedModel];

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);

      try {
        const text  = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.usage) {
              promptTokens = data.usage.prompt_tokens     || 0;
              outputTokens = data.usage.completion_tokens || 0;
            }
            const content = data?.choices?.[0]?.delta?.content || '';
            if (content) wordCount += content.split(/\s+/).filter(Boolean).length;
          } catch { /* partial frame */ }
        }
      } catch { /* decode error — ignore */ }
    },

    async flush() {
      const totalTokens = promptTokens + outputTokens;
      const costCents   = (promptTokens / 1000) * pricing.input
                        + (outputTokens / 1000) * pricing.output;
      const durationMs  = Date.now() - startTime;

      await Promise.all([
        logUsage(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
          userId, taskType, model: resolvedModel,
          promptTokens, outputTokens, totalTokens,
          costCents, wordCount, bookId,
          success: true, errorMessage: null, durationMs,
        }),
        incrementRateLimit(SUPABASE_URL!, SERVICE_ROLE_KEY!, userId, today, totalTokens, isNewBook),
      ]);
    },
  });

  return new Response(zhipuRes.body.pipeThrough(transform), {
    status:  200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
