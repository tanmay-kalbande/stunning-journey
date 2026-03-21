export const runtime = 'edge';

type TaskType = 'roadmap' | 'module' | 'enhance' | 'assemble' | 'glossary';

const ALLOWED_MODELS = ['glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.7-flashx'] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];

const TASK_DEFAULT_MODELS: Record<TaskType, AllowedModel> = {
  roadmap: 'glm-5-turbo',
  module: 'glm-5',
  enhance: 'glm-4.7-flashx',
  assemble: 'glm-4.7',
  glossary: 'glm-4.7-flashx',
};

const MODEL_PRICING: Record<AllowedModel, { input: number; output: number }> = {
  'glm-5': { input: 0, output: 0 },
  'glm-5-turbo': { input: 0, output: 0 },
  'glm-4.7': { input: 0, output: 0 },
  'glm-4.7-flashx': { input: 0, output: 0 },
};

const DAILY_LIMITS = {
  requests: 100,
  tokens: 200000,
  books: 5,
};

const GLOBAL_DAILY_BUDGET_USD = 20;

const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  const env = getRequiredEnv();
  if ('error' in env) {
    return errorResponse(500, env.error);
  }

  const startTime = Date.now();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Missing Authorization header. Please sign in.');
  }

  const userJwt = authHeader.replace('Bearer ', '');
  const userRes = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${userJwt}`,
      apikey: env.supabaseAnonKey,
    },
  });

  if (!userRes.ok) {
    return errorResponse(401, 'Invalid session. Please sign in again.');
  }

  const userData = await userRes.json();
  const userId = userData.id as string | undefined;
  if (!userId) {
    return errorResponse(401, 'Could not identify user from token.');
  }

  const today = new Date().toISOString().split('T')[0];

  const spendRes = await supabaseRequest(
    `${env.supabaseUrl}/rest/v1/ai_usage?created_at=gte.${today}T00:00:00Z&select=cost_usd_cents`,
    'GET',
    null,
    env.serviceRoleKey
  );
  const spendData = spendRes.ok ? await spendRes.json() : [];
  const todaySpend =
    spendData.reduce((sum: number, row: { cost_usd_cents?: number }) => sum + (row.cost_usd_cents || 0), 0) / 100;

  if (todaySpend >= GLOBAL_DAILY_BUDGET_USD) {
    return errorResponse(503, 'Platform is at capacity for today. Try again tomorrow.');
  }

  let body: {
    messages: Array<{ role: string; content: string }>;
    task_type?: TaskType;
    model?: string;
    book_id?: string | null;
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

  const taskType: TaskType = body.task_type || 'module';
  const bookId = body.book_id || null;
  const resolvedModel = resolveModel(taskType, body.model);

  const rateLimitRes = await supabaseRequest(
    `${env.supabaseUrl}/rest/v1/rate_limits?user_id=eq.${userId}&date=eq.${today}&select=id,requests_made,tokens_used,books_started`,
    'GET',
    null,
    env.serviceRoleKey
  );

  const rateLimitData = rateLimitRes.ok ? await rateLimitRes.json() : [];
  const current = rateLimitData[0] || { requests_made: 0, tokens_used: 0, books_started: 0 };

  if (current.requests_made >= DAILY_LIMITS.requests) {
    return errorResponse(429, `Daily limit reached: ${DAILY_LIMITS.requests} requests/day. Resets at midnight UTC.`);
  }

  if (current.tokens_used >= DAILY_LIMITS.tokens) {
    return errorResponse(429, 'Daily token limit reached. Resets at midnight UTC.');
  }

  const isNewBook = taskType === 'roadmap';
  if (isNewBook && current.books_started >= DAILY_LIMITS.books) {
    return errorResponse(429, `Daily book limit reached: ${DAILY_LIMITS.books} books/day. Resets at midnight UTC.`);
  }

  const zhipuPayload = {
    model: resolvedModel,
    messages: body.messages,
    stream: true,
    max_tokens: body.max_tokens || (taskType === 'module' ? 8192 : 4096),
    temperature: 0.7,
    stream_options: { include_usage: true },
  };

  let zhipuRes: Response;
  try {
    zhipuRes = await fetch(ZHIPU_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.zhipuApiKey}`,
      },
      body: JSON.stringify(zhipuPayload),
    });
  } catch (err) {
    await logUsage(env, {
      userId,
      taskType,
      model: resolvedModel,
      promptTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costCents: 0,
      wordCount: 0,
      bookId,
      success: false,
      errorMessage: `Network error: ${String(err)}`,
      durationMs: Date.now() - startTime,
    });
    return errorResponse(502, 'Failed to reach AI provider');
  }

  if (!zhipuRes.ok) {
    const errText = await zhipuRes.text();
    await logUsage(env, {
      userId,
      taskType,
      model: resolvedModel,
      promptTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costCents: 0,
      wordCount: 0,
      bookId,
      success: false,
      errorMessage: `Zhipu ${zhipuRes.status}: ${errText}`,
      durationMs: Date.now() - startTime,
    });
    return errorResponse(zhipuRes.status, `AI provider error: ${zhipuRes.statusText}`);
  }

  if (!zhipuRes.body) {
    return errorResponse(502, 'Empty response from AI provider');
  }

  let outputTokens = 0;
  let promptTokens = 0;
  let wordCount = 0;
  const pricing = MODEL_PRICING[resolvedModel];

  const transform = new TransformStream({
    transform(chunk: Uint8Array, controller) {
      controller.enqueue(chunk);

      const text = new TextDecoder().decode(chunk);
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.usage) {
            promptTokens = data.usage.prompt_tokens || 0;
            outputTokens = data.usage.completion_tokens || 0;
          }

          const content = data?.choices?.[0]?.delta?.content || '';
          if (content) {
            wordCount += content.split(/\s+/).filter(Boolean).length;
          }
        } catch {
          // Ignore partial event frames.
        }
      }
    },

    async flush() {
      const totalTokens = promptTokens + outputTokens;
      const costCents =
        (promptTokens / 1000) * pricing.input +
        (outputTokens / 1000) * pricing.output;
      const durationMs = Date.now() - startTime;

      await Promise.all([
        logUsage(env, {
          userId,
          taskType,
          model: resolvedModel,
          promptTokens,
          outputTokens,
          totalTokens,
          costCents,
          wordCount,
          bookId,
          success: true,
          errorMessage: null,
          durationMs,
        }),
        incrementRateLimit(env, userId, today, totalTokens, isNewBook),
      ]);
    },
  });

  return new Response(zhipuRes.body.pipeThrough(transform), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}

function resolveModel(taskType: TaskType, requestedModel?: string): AllowedModel {
  if (requestedModel && ALLOWED_MODELS.includes(requestedModel as AllowedModel)) {
    return requestedModel as AllowedModel;
  }
  return TASK_DEFAULT_MODELS[taskType];
}

function getRequiredEnv():
  | {
      zhipuApiKey: string;
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey: string;
    }
  | { error: string } {
  const zhipuApiKey = process.env.ZHIPU_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!zhipuApiKey || !supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      error:
        'Missing required server environment variables. Set ZHIPU_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.',
    };
  }

  return { zhipuApiKey, supabaseUrl, supabaseAnonKey, serviceRoleKey };
}

async function logUsage(
  env: { supabaseUrl: string; serviceRoleKey: string },
  params: {
    userId: string;
    taskType: string;
    model: string;
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
    costCents: number;
    wordCount: number;
    bookId: string | null;
    success: boolean;
    errorMessage: string | null;
    durationMs: number;
  }
) {
  await supabaseRequest(
    `${env.supabaseUrl}/rest/v1/ai_usage`,
    'POST',
    {
      user_id: params.userId,
      task_type: params.taskType,
      model_used: params.model,
      prompt_tokens: params.promptTokens,
      output_tokens: params.outputTokens,
      total_tokens: params.totalTokens,
      cost_usd_cents: params.costCents,
      word_count: params.wordCount,
      book_id: params.bookId,
      success: params.success,
      error_message: params.errorMessage,
      duration_ms: params.durationMs,
    },
    env.serviceRoleKey
  );
}

async function incrementRateLimit(
  env: { supabaseUrl: string; serviceRoleKey: string },
  userId: string,
  date: string,
  tokens: number,
  newBook: boolean
) {
  await supabaseRequest(
    `${env.supabaseUrl}/rest/v1/rpc/increment_rate_limit`,
    'POST',
    {
      p_user_id: userId,
      p_date: date,
      p_tokens: tokens,
      p_new_book: newBook,
    },
    env.serviceRoleKey
  );
}

async function supabaseRequest(
  url: string,
  method: string,
  body: object | null,
  serviceKey: string
) {
  return fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
