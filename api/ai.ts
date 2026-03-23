export const config = { runtime: 'edge' };

type TaskType = 'roadmap' | 'module' | 'enhance' | 'assemble' | 'glossary';

const ALLOWED_MODELS = ['glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.7-flashx'] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];

// Default fallback if user hasn't selected a model
const DEFAULT_MODEL: AllowedModel = 'glm-5-turbo';

const MODEL_PRICING: Record<AllowedModel, { input: number; output: number }> = {
  'glm-5': { input: 0, output: 0 },
  'glm-5-turbo': { input: 0, output: 0 },
  'glm-4.7': { input: 0, output: 0 },
  'glm-4.7-flashx': { input: 0, output: 0 },
};

const DAILY_LIMITS = { requests: 100, tokens: 200000, books: 5 };
const GLOBAL_DAILY_BUDGET_USD = 20;
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ✅ Always uses the model the user selected in the UI
// Falls back to DEFAULT_MODEL only if nothing valid is passed
function resolveModel(requestedModel?: string): AllowedModel {
  if (requestedModel && ALLOWED_MODELS.includes(requestedModel as AllowedModel)) {
    return requestedModel as AllowedModel;
  }
  return DEFAULT_MODEL;
}

// ✅ Max tokens (8192) for every task — no artificial limits
function maxTokensForTask(taskType: TaskType, requestedMaxTokens?: number): number {
  if (requestedMaxTokens) return requestedMaxTokens;
  return 8192;
}

// ✅ All Supabase calls have 5s timeout — never hangs the edge function
async function supabaseRequest(
  url: string,
  method: string,
  body: object | null,
  serviceKey: string,
  extraHeaders?: Record<string, string>
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        ...extraHeaders,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // Supabase timed out — return empty success so generation still proceeds
    return new Response(JSON.stringify([]), { status: 200 });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function logUsage(
  supabaseUrl: string,
  serviceRoleKey: string,
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
  try {
    await supabaseRequest(
      `${supabaseUrl}/rest/v1/ai_usage`,
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
      serviceRoleKey
    );
  } catch (error) {
    console.error('[ai/api] logUsage failed (non-fatal):', error);
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
  } catch (error) {
    console.error('[ai/api] incrementRateLimit failed (non-fatal):', error);
  }
}

export default async function handler(req: Request): Promise<Response> {
  try {
    return await runHandler(req);
  } catch (fatal) {
    const message = fatal instanceof Error ? fatal.message : String(fatal);
    console.error('[ai/api] FATAL unhandled error:', message);
    return errorResponse(500, `Internal server error: ${message}`);
  }
}

async function runHandler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[ai/api] env check:', {
    ZHIPU_API_KEY: !!ZHIPU_API_KEY,
    SUPABASE_URL: !!SUPABASE_URL,
    SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY,
    SERVICE_ROLE_KEY: !!SERVICE_ROLE_KEY,
  });

  const missing: string[] = [];
  if (!ZHIPU_API_KEY) missing.push('ZHIPU_API_KEY');
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    return errorResponse(
      500,
      `Missing server env vars: ${missing.join(', ')}. Add them in Vercel -> Settings -> Environment Variables and redeploy.`
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Missing Authorization header. Please sign in.');
  }

  const userJwt = authHeader.replace('Bearer ', '');

  // Auth check with 8s timeout
  const authController = new AbortController();
  const authTimeout = setTimeout(() => authController.abort(), 8000);

  let userRes: Response;
  try {
    userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      signal: authController.signal,
      headers: {
        Authorization: `Bearer ${userJwt}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
  } catch {
    return errorResponse(401, 'Auth check timed out. Please try again.');
  } finally {
    clearTimeout(authTimeout);
  }

  if (!userRes.ok) {
    return errorResponse(401, 'Invalid session. Please sign in again.');
  }

  const userData = (await userRes.json()) as { id?: string };
  const userId = userData.id;
  if (!userId) {
    return errorResponse(401, 'Could not identify user from token.');
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

  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const taskType = body.task_type || 'module';
  const bookId = body.book_id || null;

  // ✅ User-selected model from the UI is always used for everything
  const resolvedModel = resolveModel(body.model);
  const pricing = MODEL_PRICING[resolvedModel];
  const isNewBook = taskType === 'roadmap';
  const isLightTask = ['enhance', 'glossary'].includes(taskType);

  console.log('[ai/api] model:', resolvedModel, '| task:', taskType, '| tokens: 8192');

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let promptTokens = 0;
      let outputTokens = 0;
      let wordCount = 0;
      let upstreamBuffer = '';

      const sendComment = (message: string) => {
        controller.enqueue(encoder.encode(`: ${message}\n\n`));
      };

      const sendError = (message: string) => {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`)
        );
      };

      const parseProviderFrames = (text: string) => {
        upstreamBuffer += text;
        const frames = upstreamBuffer.split('\n\n');
        upstreamBuffer = frames.pop() || '';

        for (const frame of frames) {
          const trimmedFrame = frame.trim();
          if (!trimmedFrame) continue;

          for (const line of trimmedFrame.split('\n')) {
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
              // Ignore partial frames until more bytes arrive
            }
          }
        }
      };

      const failRequest = async (message: string) => {
        console.error('[ai/api] stream error:', message);
        await logUsage(SUPABASE_URL, SERVICE_ROLE_KEY, {
          userId,
          taskType,
          model: resolvedModel,
          promptTokens,
          outputTokens,
          totalTokens: promptTokens + outputTokens,
          costCents: 0,
          wordCount,
          bookId,
          success: false,
          errorMessage: message,
          durationMs: Date.now() - startTime,
        });
        sendError(message);
      };

      const heartbeat = setInterval(() => {
        try {
          sendComment('ping');
        } catch {
          // Ignore close-time races
        }
      }, 15000);

      sendComment('connected');

      void (async () => {
        try {
          // Parallel Supabase checks — skip spend scan for light tasks
          const [spendRes, rateLimitRes] = await Promise.all([
            isLightTask
              ? Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
              : supabaseRequest(
                  `${SUPABASE_URL}/rest/v1/ai_usage?created_at=gte.${today}T00:00:00Z&select=cost_usd_cents`,
                  'GET',
                  null,
                  SERVICE_ROLE_KEY
                ),
            supabaseRequest(
              `${SUPABASE_URL}/rest/v1/rate_limits?user_id=eq.${userId}&date=eq.${today}&select=id,requests_made,tokens_used,books_started`,
              'GET',
              null,
              SERVICE_ROLE_KEY
            ),
          ]);

          if (!isLightTask) {
            const spendData = spendRes.ok
              ? ((await spendRes.json()) as Array<{ cost_usd_cents?: number }>)
              : [];
            const todaySpend =
              spendData.reduce((sum, row) => sum + (row.cost_usd_cents || 0), 0) / 100;
            if (todaySpend >= GLOBAL_DAILY_BUDGET_USD) {
              await failRequest('Platform is at capacity for today. Try again tomorrow.');
              return;
            }
          }

          const rateLimitData = rateLimitRes.ok
            ? ((await rateLimitRes.json()) as Array<{
                requests_made: number;
                tokens_used: number;
                books_started: number;
              }>)
            : [];
          const current = rateLimitData[0] || {
            requests_made: 0,
            tokens_used: 0,
            books_started: 0,
          };

          if (current.requests_made >= DAILY_LIMITS.requests) {
            await failRequest(
              `Daily limit: ${DAILY_LIMITS.requests} requests/day. Resets at midnight UTC.`
            );
            return;
          }
          if (current.tokens_used >= DAILY_LIMITS.tokens) {
            await failRequest('Daily token limit reached. Resets at midnight UTC.');
            return;
          }
          if (isNewBook && current.books_started >= DAILY_LIMITS.books) {
            await failRequest(
              `Daily book limit: ${DAILY_LIMITS.books} books/day. Resets at midnight UTC.`
            );
            return;
          }

          // ✅ Call Zhipu with user-selected model and max tokens
          let zhipuRes: Response;
          try {
            zhipuRes = await fetch(ZHIPU_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ZHIPU_API_KEY}`,
              },
              body: JSON.stringify({
                model: resolvedModel,
                messages: body.messages,
                stream: true,
                max_tokens: maxTokensForTask(taskType, body.max_tokens),
                temperature: 0.7,
                stream_options: { include_usage: true },
              }),
            });
          } catch (networkError) {
            const message =
              networkError instanceof Error ? networkError.message : String(networkError);
            await failRequest(`Failed to reach AI provider: ${message}`);
            return;
          }

          if (!zhipuRes.ok) {
            const providerError = await zhipuRes.text().catch(() => zhipuRes.statusText);
            await failRequest(`AI provider error (${zhipuRes.status}): ${providerError}`);
            return;
          }

          if (!zhipuRes.body) {
            await failRequest('Empty response from AI provider');
            return;
          }

          const reader = zhipuRes.body.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            controller.enqueue(value);
            parseProviderFrames(decoder.decode(value, { stream: true }));
          }

          parseProviderFrames(decoder.decode());

          const totalTokens = promptTokens + outputTokens;
          const costCents =
            (promptTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;

          await Promise.all([
            logUsage(SUPABASE_URL, SERVICE_ROLE_KEY, {
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
              durationMs: Date.now() - startTime,
            }),
            incrementRateLimit(
              SUPABASE_URL,
              SERVICE_ROLE_KEY,
              userId,
              today,
              totalTokens,
              isNewBook
            ),
          ]);
        } catch (fatal) {
          const message = fatal instanceof Error ? fatal.message : String(fatal);
          await failRequest(`Internal server error: ${message}`);
        } finally {
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            // Ignore double-close races when client disconnects mid-stream
          }
        }
      })();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
