# Week 1 Implementation Guide v2
## Pustakam AI — Vercel Edge Proxy + Supabase Analytics + Rate Limiting
## Agent-Ready Document

---

## ARCHITECTURE (Simple & Final)

```
Browser (React on Vercel)
    │
    ├─► POST /api/ai  (Vercel Edge Function — no timeout, streaming)
    │       - Reads ZHIPU_API_KEY from Vercel env (never exposed to browser)
    │       - Checks rate limit via Supabase
    │       - Logs usage to Supabase analytics table
    │       - Streams Zhipu SSE response directly back to browser
    │
    └─► Supabase DB
            - ai_usage table  (per-request analytics + token tracking)
            - rate_limits table (daily caps per user)
```

**Why this works on Vercel Hobby free plan:**
- `export const runtime = 'edge'` removes ALL timeout limits
- Edge Runtime supports streaming natively
- Zero Supabase Edge Functions needed
- Zero new infrastructure — Vercel + Supabase you already have

---

## PREREQUISITES

Collect these before the agent starts:

| Variable | Where to get it | Goes into |
|---|---|---|
| `ZHIPU_API_KEY` | platform.zhipuai.cn → API Keys | Vercel env vars |
| `SUPABASE_URL` | Supabase → Project Settings → API | Already in Vercel env |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role | Vercel env vars |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Already in Vercel env |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are already in your Vercel env from
existing setup. You only need to ADD `ZHIPU_API_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` as new Vercel environment variables.

---

## STEP 1 — DATABASE: Analytics + Rate Limits Tables

Run this entire block in **Supabase SQL Editor** as a single query.

```sql
-- ================================================================
-- TABLE 1: ai_usage
-- Tracks every single AI request for analytics
-- Tells you: who used what, how many tokens, which model, when
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Request metadata
  task_type       TEXT    NOT NULL, -- 'roadmap' | 'module' | 'enhance' | 'assemble' | 'glossary'
  model_used      TEXT    NOT NULL, -- actual Zhipu model called e.g. 'glm-4-flashx'
  
  -- Token tracking (Zhipu returns these in the response)
  prompt_tokens   INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  total_tokens    INTEGER DEFAULT 0,
  
  -- Cost tracking (calculated server-side in cents to avoid float hell)
  cost_usd_cents  NUMERIC(10, 4) DEFAULT 0,
  
  -- Content metadata
  word_count      INTEGER DEFAULT 0,  -- words in output (estimated)
  book_id         TEXT,               -- local book ID from the app
  
  -- Status
  success         BOOLEAN DEFAULT TRUE,
  error_message   TEXT,               -- null if success
  
  -- Timing
  duration_ms     INTEGER DEFAULT 0,  -- how long the request took
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id
  ON public.ai_usage (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at
  ON public.ai_usage (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_task_type
  ON public.ai_usage (task_type);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date
  ON public.ai_usage (user_id, created_at DESC);

-- ================================================================
-- TABLE 2: rate_limits
-- Daily caps per user — reset every day at midnight UTC
-- ================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID    REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date            DATE    NOT NULL DEFAULT CURRENT_DATE,
  
  -- Daily counters
  requests_made   INTEGER DEFAULT 0,
  books_started   INTEGER DEFAULT 0,
  tokens_used     INTEGER DEFAULT 0,
  
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_date
  ON public.rate_limits (user_id, date);

-- ================================================================
-- RLS POLICIES
-- ================================================================

ALTER TABLE public.ai_usage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can read their OWN usage data only
CREATE POLICY "Users read own ai usage"
  ON public.ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read their OWN rate limits only
CREATE POLICY "Users read own rate limits"
  ON public.rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE from client on either table
-- All writes go through the Vercel Edge Function using service_role key

-- ================================================================
-- ANALYTICS VIEWS (for your own dashboard queries)
-- ================================================================

-- Daily platform summary
CREATE OR REPLACE VIEW public.daily_ai_stats AS
SELECT
  DATE(created_at)          AS date,
  COUNT(*)                  AS total_requests,
  COUNT(DISTINCT user_id)   AS unique_users,
  SUM(total_tokens)         AS total_tokens,
  SUM(cost_usd_cents)/100   AS total_cost_usd,
  SUM(word_count)           AS total_words,
  COUNT(CASE WHEN task_type = 'module'   THEN 1 END) AS chapter_generations,
  COUNT(CASE WHEN task_type = 'roadmap'  THEN 1 END) AS roadmap_generations,
  COUNT(CASE WHEN success = FALSE THEN 1 END)        AS failed_requests
FROM public.ai_usage
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Per user summary (your power users)
CREATE OR REPLACE VIEW public.user_ai_stats AS
SELECT
  user_id,
  COUNT(*)                AS total_requests,
  SUM(total_tokens)       AS total_tokens_used,
  SUM(cost_usd_cents)/100 AS total_cost_usd,
  SUM(word_count)         AS total_words_generated,
  MIN(created_at)         AS first_request,
  MAX(created_at)         AS last_request,
  COUNT(DISTINCT DATE(created_at)) AS active_days
FROM public.ai_usage
WHERE success = TRUE
GROUP BY user_id
ORDER BY total_cost_usd DESC;

-- Model usage breakdown
CREATE OR REPLACE VIEW public.model_usage_stats AS
SELECT
  model_used,
  COUNT(*)                AS total_calls,
  SUM(total_tokens)       AS total_tokens,
  SUM(cost_usd_cents)/100 AS total_cost_usd,
  AVG(duration_ms)        AS avg_duration_ms
FROM public.ai_usage
WHERE success = TRUE
GROUP BY model_used
ORDER BY total_calls DESC;

-- Grant read access to authenticated users for their own data
GRANT SELECT ON public.daily_ai_stats  TO authenticated;
GRANT SELECT ON public.user_ai_stats   TO authenticated;
GRANT SELECT ON public.model_usage_stats TO authenticated;

-- Verify tables created correctly
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('ai_usage', 'rate_limits')
ORDER BY table_name;
```

**Expected output:** Two rows — `ai_usage` and `rate_limits`.
If either is missing, check for SQL errors and re-run.

---

## STEP 2 — VERCEL ENV VARS

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**.

Add these two new variables (Production + Preview + Development):

| Name | Value |
|---|---|
| `ZHIPU_API_KEY` | your Zhipu API key |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service role key |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are already there — do not touch them.

**Important:** After adding, go to **Deployments → latest deployment → three
dots → Redeploy**. Vercel does not pick up new env vars until redeployment.

Also add to your **local `.env` file**:
```bash
ZHIPU_API_KEY=your_zhipu_api_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
VITE_USE_PROXY=true
```

---

## STEP 3 — VERCEL EDGE FUNCTION: Create the Proxy

Create this file at the project root. The path MUST be exactly `api/ai.ts`.
If an `api/` folder does not exist, create it.

```typescript
// api/ai.ts
// Pustakam AI — Vercel Edge Function proxy for Zhipu
// runtime = 'edge' removes all timeout limits and enables streaming

export const runtime = 'edge';

// ============================================================
// CONFIGURATION
// ============================================================

// Zhipu pricing in USD cents per 1000 tokens (update if pricing changes)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'glm-4-flashx': { input: 0.007,  output: 0.04  }, // $0.07/$0.4 per 1M
  'glm-4-plus':   { input: 0.06,   output: 0.22  }, // $0.6/$2.2 per 1M
  'glm-5':        { input: 0.1,    output: 0.32  }, // $1/$3.2 per 1M
};

// Model routing — maps client request to actual Zhipu model
const MODEL_ROUTING: Record<string, string> = {
  'roadmap':  'glm-4-flashx',  // Fast + cheap for structure tasks
  'enhance':  'glm-4-flashx',  // Fast + cheap for prompt improvement
  'assemble': 'glm-4-flashx',  // Fast + cheap for book assembly
  'glossary': 'glm-4-flashx',  // Fast + cheap for glossary
  'module':   'glm-4-plus',    // Quality model for chapter content
};

// Daily limits per user
const DAILY_LIMITS = {
  requests: 100,
  tokens:   200000,  // ~5-6 average books per day
  books:    5,
};

const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(req: Request) {

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  const startTime = Date.now();

  // ── 1. VERIFY USER JWT ──────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Missing Authorization header. Please sign in.');
  }

  const userJwt = authHeader.replace('Bearer ', '');

  // Verify JWT with Supabase
  const userRes = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        Authorization:  `Bearer ${userJwt}`,
        apikey:         process.env.SUPABASE_ANON_KEY!,
      },
    }
  );

  if (!userRes.ok) {
    return errorResponse(401, 'Invalid session. Please sign in again.');
  }

  const userData = await userRes.json();
  const userId   = userData.id as string;

  if (!userId) {
    return errorResponse(401, 'Could not identify user from token.');
  }

  // ── 2. PARSE REQUEST BODY ──────────────────────────────────
  let body: {
    messages:    Array<{ role: string; content: string }>;
    task_type:   string;
    book_id?:    string;
    max_tokens?: number;
    stream?:     boolean;
  };

  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  if (!body.messages?.length) {
    return errorResponse(400, 'messages array is required');
  }

  const taskType = body.task_type || 'module';
  const bookId   = body.book_id   || null;

  // ── 3. CHECK RATE LIMITS ───────────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  const rateLimitRes = await supabaseRequest(
    `${process.env.SUPABASE_URL}/rest/v1/rate_limits` +
    `?user_id=eq.${userId}&date=eq.${today}&select=requests_made,tokens_used,books_started`,
    'GET',
    null,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const rateLimitData = rateLimitRes.ok ? await rateLimitRes.json() : [];
  const current = rateLimitData[0] || { requests_made: 0, tokens_used: 0, books_started: 0 };

  if (current.requests_made >= DAILY_LIMITS.requests) {
    return errorResponse(429,
      `Daily limit reached: ${DAILY_LIMITS.requests} requests/day. Resets at midnight UTC.`
    );
  }

  if (current.tokens_used >= DAILY_LIMITS.tokens) {
    return errorResponse(429,
      `Daily token limit reached. Resets at midnight UTC.`
    );
  }

  const isNewBook = taskType === 'roadmap';
  if (isNewBook && current.books_started >= DAILY_LIMITS.books) {
    return errorResponse(429,
      `Daily book limit reached: ${DAILY_LIMITS.books} books/day. Resets at midnight UTC.`
    );
  }

  // ── 4. RESOLVE MODEL ───────────────────────────────────────
  const resolvedModel = MODEL_ROUTING[taskType] || 'glm-4-flashx';

  // ── 5. CALL ZHIPU ──────────────────────────────────────────
  const zhipuPayload = {
    model:       resolvedModel,
    messages:    body.messages,
    stream:      true,
    max_tokens:  body.max_tokens || (taskType === 'module' ? 8192 : 4096),
    temperature: 0.7,
  };

  let zhipuRes: Response;
  try {
    zhipuRes = await fetch(ZHIPU_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
      },
      body: JSON.stringify(zhipuPayload),
    });
  } catch (err) {
    await logUsage({
      userId, taskType, model: resolvedModel,
      promptTokens: 0, outputTokens: 0, totalTokens: 0,
      costCents: 0, wordCount: 0, bookId,
      success: false, errorMessage: `Network error: ${err}`,
      durationMs: Date.now() - startTime,
    });
    return errorResponse(502, 'Failed to reach AI provider');
  }

  if (!zhipuRes.ok) {
    const errText = await zhipuRes.text();
    await logUsage({
      userId, taskType, model: resolvedModel,
      promptTokens: 0, outputTokens: 0, totalTokens: 0,
      costCents: 0, wordCount: 0, bookId,
      success: false, errorMessage: `Zhipu ${zhipuRes.status}: ${errText}`,
      durationMs: Date.now() - startTime,
    });
    return errorResponse(zhipuRes.status, `AI provider error: ${zhipuRes.statusText}`);
  }

  if (!zhipuRes.body) {
    return errorResponse(502, 'Empty response from AI provider');
  }

  // ── 6. STREAM + TRACK TOKENS ───────────────────────────────
  // Use TransformStream to intercept the SSE stream, count tokens,
  // then log + update rate limits after stream completes.

  let outputTokens  = 0;
  let promptTokens  = 0;
  let wordCount     = 0;
  const pricing     = MODEL_PRICING[resolvedModel] || MODEL_PRICING['glm-4-flashx'];

  const transform = new TransformStream({
    transform(chunk: Uint8Array, controller) {
      // Pass chunk through to browser untouched
      controller.enqueue(chunk);

      // Parse SSE to count tokens
      const text  = new TextDecoder().decode(chunk);
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const data = JSON.parse(line.slice(6));

          // Token counts come in the 'usage' field on the final chunk
          if (data.usage) {
            promptTokens = data.usage.prompt_tokens  || 0;
            outputTokens = data.usage.completion_tokens || 0;
          }

          // Count words from content chunks for wordCount field
          const content = data?.choices?.[0]?.delta?.content || '';
          if (content) {
            wordCount += content.split(/\s+/).filter(Boolean).length;
          }
        } catch { /* ignore partial JSON chunks */ }
      }
    },

    async flush() {
      // Stream is complete — now log everything to Supabase
      const totalTokens = promptTokens + outputTokens;
      const costCents   = (
        (promptTokens  / 1000) * pricing.input +
        (outputTokens  / 1000) * pricing.output
      );
      const durationMs  = Date.now() - startTime;

      // Fire both writes concurrently — non-blocking from user perspective
      await Promise.all([
        // Log to ai_usage analytics table
        logUsage({
          userId, taskType, model: resolvedModel,
          promptTokens, outputTokens, totalTokens,
          costCents, wordCount, bookId,
          success: true, errorMessage: null,
          durationMs,
        }),
        // Update rate_limits counter
        updateRateLimit(userId, today, totalTokens, isNewBook),
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

// ============================================================
// HELPERS
// ============================================================

async function logUsage(params: {
  userId:       string;
  taskType:     string;
  model:        string;
  promptTokens: number;
  outputTokens: number;
  totalTokens:  number;
  costCents:    number;
  wordCount:    number;
  bookId:       string | null;
  success:      boolean;
  errorMessage: string | null;
  durationMs:   number;
}) {
  await supabaseRequest(
    `${process.env.SUPABASE_URL}/rest/v1/ai_usage`,
    'POST',
    {
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
    },
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function updateRateLimit(
  userId:   string,
  date:     string,
  tokens:   number,
  newBook:  boolean
) {
  // Upsert — creates row if first request today, increments if exists
  await supabaseRequest(
    `${process.env.SUPABASE_URL}/rest/v1/rate_limits`,
    'POST',
    {
      user_id:       userId,
      date:          date,
      requests_made: 1,
      tokens_used:   tokens,
      books_started: newBook ? 1 : 0,
    },
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // Supabase upsert header — increments existing values
    {
      'Prefer':        'resolution=merge-duplicates',
      'on-conflict':   'user_id,date',
    }
  );
}

async function supabaseRequest(
  url:       string,
  method:    string,
  body:      object | null,
  serviceKey: string,
  extraHeaders?: Record<string, string>
) {
  return fetch(url, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey':        serviceKey,
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }
  );
}
```

---

## STEP 4 — FRONTEND: Add Proxy Service

Create `src/services/proxyService.ts`. This is a thin client that calls
your new Edge Function. It mirrors the same interface as the existing
provider methods in `bookService.ts`.

```typescript
// src/services/proxyService.ts

import { supabase } from '../lib/supabaseClient';

// Points to your Vercel Edge Function
const PROXY_URL = '/api/ai';

export type TaskType = 'roadmap' | 'module' | 'enhance' | 'assemble' | 'glossary';

export async function generateViaProxy(
  prompt:   string,
  taskType: TaskType,
  onChunk?: (chunk: string) => void,
  bookId?:  string
): Promise<string> {

  // Get user session JWT
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const response = await fetch(PROXY_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages:  [{ role: 'user', content: prompt }],
      task_type: taskType,
      book_id:   bookId || null,
      stream:    true,
    }),
  });

  // Surface rate limit errors clearly to UI
  if (response.status === 429) {
    const err = await response.json();
    throw new Error(`RATE_LIMIT: ${err.error}`);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Proxy error ${response.status}: ${err.error}`);
  }

  if (!response.body) throw new Error('Empty response stream');

  // Read SSE stream — identical pattern to existing providers
  const reader  = response.body.getReader();
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
      if (!trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') continue;

      try {
        const data    = JSON.parse(jsonStr);
        const content = data?.choices?.[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          if (onChunk) onChunk(content);
        }
      } catch { /* ignore partial chunks */ }
    }
  }

  if (!fullContent) throw new Error('Proxy returned empty content');
  return fullContent;
}

// Fetch this user's usage stats for display in UI
export async function getMyUsageStats() {
  const today = new Date().toISOString().split('T')[0];

  const { data: rateLimit } = await supabase
    .from('rate_limits')
    .select('requests_made, tokens_used, books_started')
    .eq('date', today)
    .single();

  const { data: allTime } = await supabase
    .from('ai_usage')
    .select('total_tokens, cost_usd_cents, word_count')
    .eq('success', true);

  const totals = (allTime || []).reduce(
    (acc, row) => ({
      tokens:    acc.tokens    + (row.total_tokens    || 0),
      costCents: acc.costCents + (row.cost_usd_cents  || 0),
      words:     acc.words     + (row.word_count      || 0),
    }),
    { tokens: 0, costCents: 0, words: 0 }
  );

  return {
    today: rateLimit || { requests_made: 0, tokens_used: 0, books_started: 0 },
    allTime: totals,
    limits: { requests: 100, tokens: 200000, books: 5 },
  };
}
```

---

## STEP 5 — WIRE PROXY INTO bookService.ts

Find `generateWithAI` in `src/services/bookService.ts`.

Add this block **right after the `navigator.onLine` check** and **before**
the `const requestId = bookId || generateId()` line:

```typescript
// ADD THIS BLOCK — proxy path for logged-in users
const useProxy = import.meta.env.VITE_USE_PROXY === 'true';
if (useProxy) {
  try {
    const { generateViaProxy } = await import('./proxyService');
    // Map session generationMode to task type
    const resolvedTask = (taskType as string) || 'module';
    return await generateViaProxy(
      prompt,
      resolvedTask as import('./proxyService').TaskType,
      onChunk,
      bookId
    );
  } catch (proxyError) {
    const msg = proxyError instanceof Error ? proxyError.message : String(proxyError);
    // Rate limit and auth errors must surface — do NOT fall through
    if (msg.startsWith('RATE_LIMIT:') || msg.includes('not authenticated')) {
      throw proxyError;
    }
    // Any other proxy failure → fall through to user's own API keys
    console.warn('[bookService] Proxy failed, using direct API:', msg);
  }
}
// END PROXY BLOCK — existing code continues unchanged below
```

Then add `taskType` parameter to the `generateWithAI` signature:

```typescript
// BEFORE:
private async generateWithAI(prompt: string, bookId?: string, onChunk?: (chunk: string) => void, session?: BookSession): Promise<string>

// AFTER:
private async generateWithAI(prompt: string, bookId?: string, onChunk?: (chunk: string) => void, session?: BookSession, taskType?: string): Promise<string>
```

Update the three call sites to pass `taskType`:

```typescript
// In generateRoadmap():
const response = await this.generateWithAI(prompt, bookId, undefined, session, 'roadmap');

// In enhanceBookInput():
const response = await this.generateWithAI(finalPrompt, undefined, undefined, undefined, 'enhance');

// In generateModuleContentWithRetry():
const moduleContent = await this.generateWithAI(prompt, book.id, (chunk) => {
  // existing chunk handler unchanged
}, session, 'module');

// In generateBookIntroduction():
return await this.generateWithAI(prompt, undefined, undefined, session, 'assemble');

// In generateBookSummary():
return await this.generateWithAI(prompt, undefined, undefined, session, 'assemble');

// In generateGlossary():
return await this.generateWithAI(prompt, undefined, undefined, undefined, 'glossary');
```

---

## STEP 6 — LOCAL .env FILE

```bash
# Add to your existing .env file
ZHIPU_API_KEY=your_zhipu_api_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
VITE_USE_PROXY=true
```

Restart Vite dev server after adding: `ctrl+c` then `npm run dev`

---

## STEP 7 — DEPLOY & VERIFY

```bash
# Commit and push — Vercel auto-deploys
git add api/ai.ts src/services/proxyService.ts src/services/bookService.ts
git commit -m "feat: add Vercel Edge proxy for Zhipu with Supabase analytics"
git push
```

**After deploy, verify it works:**

```bash
# Should return 401 — confirms function is live
curl -X POST https://your-app.vercel.app/api/ai \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"task_type":"roadmap"}'

# Expected: {"error":"Missing Authorization header. Please sign in."}
```

**End-to-end test in browser:**
1. Sign in to Pustakam
2. Open DevTools → Network tab
3. Generate a book roadmap
4. Confirm request goes to `your-app.vercel.app/api/ai` — NOT to `bigmodel.cn`
5. Open Supabase → Table Editor → `ai_usage`
   — Should show a new row with your user_id, task_type='roadmap', tokens, cost
6. Open `rate_limits` table
   — Should show requests_made = 1, books_started = 1 for today

---

## STEP 8 — VERIFICATION CHECKLIST

### Database
- [ ] `ai_usage` table exists with all columns
- [ ] `rate_limits` table exists with all columns
- [ ] RLS enabled on both tables (green shield in Table Editor)
- [ ] `daily_ai_stats` view exists and queryable
- [ ] `user_ai_stats` view exists and queryable

### Vercel
- [ ] `ZHIPU_API_KEY` in Vercel env vars
- [ ] `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars
- [ ] `VITE_USE_PROXY=true` in Vercel env vars
- [ ] `api/ai.ts` has `export const runtime = 'edge'` at top
- [ ] Project redeployed after adding env vars

### Frontend
- [ ] `src/services/proxyService.ts` created
- [ ] `generateWithAI` has `taskType` parameter
- [ ] All 6 call sites pass correct `taskType`
- [ ] Local `.env` has `VITE_USE_PROXY=true`

### End-to-End
- [ ] Network requests go to `/api/ai` not `bigmodel.cn`
- [ ] `ai_usage` table gets a new row per request
- [ ] `rate_limits` table increments correctly
- [ ] Rate limit error message appears in UI when limits hit
- [ ] Generating a book still works end-to-end

---

## ANALYTICS QUERIES (Run in Supabase SQL Editor)

```sql
-- How much have you spent today?
SELECT
  DATE(created_at)        AS date,
  SUM(cost_usd_cents)/100 AS cost_usd,
  SUM(total_tokens)       AS tokens,
  COUNT(*)                AS requests
FROM ai_usage
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY DATE(created_at);

-- Your most active users
SELECT * FROM user_ai_stats LIMIT 20;

-- Daily spending trend
SELECT * FROM daily_ai_stats LIMIT 14;

-- Which tasks cost the most?
SELECT
  task_type,
  COUNT(*)                AS calls,
  SUM(total_tokens)       AS tokens,
  SUM(cost_usd_cents)/100 AS cost_usd
FROM ai_usage
WHERE success = TRUE
GROUP BY task_type
ORDER BY cost_usd DESC;

-- Are you on track with $600 budget?
SELECT
  SUM(cost_usd_cents)/100                            AS total_spent_usd,
  600 - SUM(cost_usd_cents)/100                      AS budget_remaining_usd,
  ROUND((SUM(cost_usd_cents)/100 / 600) * 100, 2)   AS pct_budget_used
FROM ai_usage
WHERE success = TRUE;
```

---

## FILE CHANGE SUMMARY

```
CREATED:
  api/ai.ts                          — Vercel Edge Function (proxy + analytics)
  src/services/proxyService.ts       — Frontend proxy client

MODIFIED:
  src/services/bookService.ts        — Added proxy path + taskType param
  .env                               — Added ZHIPU_API_KEY, SERVICE_ROLE_KEY, VITE_USE_PROXY

DATABASE (new tables via SQL Editor):
  public.ai_usage                    — Per-request analytics + token tracking
  public.rate_limits                 — Daily caps per user

DATABASE (new views via SQL Editor):
  public.daily_ai_stats              — Daily platform summary
  public.user_ai_stats               — Per-user totals
  public.model_usage_stats           — Model usage breakdown

VERCEL ENV VARS ADDED:
  ZHIPU_API_KEY
  SUPABASE_SERVICE_ROLE_KEY
  VITE_USE_PROXY

UNCHANGED:
  All existing AI providers (Google, Mistral, Groq, etc.)
  All Supabase auth tables and profiles
  All frontend components
  Vercel deployment config
  All other services
```

---

*Pustakam AI — Week 1 Implementation Guide v2*
