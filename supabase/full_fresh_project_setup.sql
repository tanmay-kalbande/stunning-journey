-- ============================================================================
-- PUSTAKAM AGNI: FULL FRESH SUPABASE SETUP
-- One-shot script for a brand new Supabase project.
-- Safe approach: drops existing app objects, recreates everything needed.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- STEP 1: DROP APP OBJECTS
-- ============================================================================

DROP VIEW IF EXISTS public.ai_model_usage_stats CASCADE;
DROP VIEW IF EXISTS public.user_ai_stats CASCADE;
DROP VIEW IF EXISTS public.daily_ai_stats CASCADE;
DROP VIEW IF EXISTS public.model_usage_stats CASCADE;
DROP VIEW IF EXISTS public.daily_stats CASCADE;
DROP VIEW IF EXISTS public.platform_stats CASCADE;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.increment_books_created(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.increment_rate_limit(uuid, date, integer, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.record_book_completed(text, text, text, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.subscribe_newsletter(text) CASCADE;

DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.ai_usage CASCADE;
DROP TABLE IF EXISTS public.app_activity CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.book_history CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================================
-- STEP 2: CREATE TABLES
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  plan TEXT NOT NULL DEFAULT 'yearly' CHECK (plan IN ('free', 'monthly', 'yearly')),
  plan_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
  books_created INTEGER NOT NULL DEFAULT 0,
  total_words_generated INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.book_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT,
  generation_mode TEXT NOT NULL DEFAULT 'stellar',
  modules_count INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.app_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  model_used TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  book_id TEXT,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  requests_made INTEGER NOT NULL DEFAULT 0,
  books_started INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_book_history_user_id ON public.book_history(user_id);
CREATE INDEX idx_book_history_created_at ON public.book_history(created_at DESC);
CREATE INDEX idx_app_activity_user_id ON public.app_activity(user_id);
CREATE INDEX idx_app_activity_created_at ON public.app_activity(created_at DESC);
CREATE INDEX idx_ai_usage_user_id ON public.ai_usage(user_id);
CREATE INDEX idx_ai_usage_created_at ON public.ai_usage(created_at DESC);
CREATE INDEX idx_ai_usage_task_type ON public.ai_usage(task_type);
CREATE INDEX idx_ai_usage_user_date ON public.ai_usage(user_id, created_at DESC);
CREATE INDEX idx_rate_limits_user_date ON public.rate_limits(user_id, date);

-- ============================================================================
-- STEP 3: CREATE FUNCTIONS + TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    plan,
    plan_expires_at,
    books_created,
    total_words_generated
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'yearly',
    NOW() + INTERVAL '1 year',
    0,
    0
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_books_created(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET books_created = books_created + 1,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_user_id UUID,
  p_date DATE,
  p_tokens INTEGER,
  p_new_book BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.rate_limits (
    user_id,
    date,
    requests_made,
    tokens_used,
    books_started
  )
  VALUES (
    p_user_id,
    p_date,
    1,
    p_tokens,
    CASE WHEN p_new_book THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    requests_made = public.rate_limits.requests_made + 1,
    tokens_used   = public.rate_limits.tokens_used + EXCLUDED.tokens_used,
    books_started = public.rate_limits.books_started + EXCLUDED.books_started,
    updated_at    = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.record_book_completed(
  p_book_id TEXT,
  p_title TEXT,
  p_goal TEXT,
  p_generation_mode TEXT,
  p_modules_count INTEGER,
  p_word_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.book_history (
    user_id,
    book_id,
    title,
    goal,
    generation_mode,
    modules_count,
    word_count
  ) VALUES (
    v_user_id,
    p_book_id,
    p_title,
    p_goal,
    COALESCE(p_generation_mode, 'stellar'),
    COALESCE(p_modules_count, 0),
    COALESCE(p_word_count, 0)
  );

  UPDATE public.profiles
  SET books_created = books_created + 1,
      total_words_generated = total_words_generated + COALESCE(p_word_count, 0),
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.subscribe_newsletter(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.newsletter_subscribers (email)
  VALUES (LOWER(TRIM(p_email)))
  ON CONFLICT (email) DO NOTHING;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- STEP 4: ENABLE RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: CREATE POLICIES
-- ============================================================================

CREATE POLICY "Users read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users read own book history"
  ON public.book_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own book history"
  ON public.book_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own activity"
  ON public.app_activity
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users read own ai usage"
  ON public.ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own rate limits"
  ON public.rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 6: GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.book_history TO authenticated;
GRANT SELECT ON public.app_activity TO authenticated;
GRANT INSERT ON public.newsletter_subscribers TO anon;
GRANT INSERT ON public.newsletter_subscribers TO authenticated;
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT SELECT ON public.rate_limits TO authenticated;

GRANT EXECUTE ON FUNCTION public.increment_books_created(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(uuid, date, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_book_completed(text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text) TO anon;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text) TO authenticated;

-- ============================================================================
-- STEP 7: VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW public.platform_stats AS
SELECT
  (SELECT COUNT(*) FROM public.profiles) AS total_users,
  (SELECT COUNT(*) FROM public.book_history) AS total_books,
  (SELECT COALESCE(SUM(word_count), 0) FROM public.book_history) AS total_words,
  (SELECT COALESCE(AVG(word_count), 0)::INTEGER FROM public.book_history) AS avg_words_per_book,
  (
    SELECT generation_mode
    FROM public.book_history
    GROUP BY generation_mode
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS most_used_mode,
  (
    SELECT COUNT(*)
    FROM public.book_history
    WHERE created_at >= CURRENT_DATE
  ) AS books_today,
  (
    SELECT COUNT(*)
    FROM public.book_history
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  ) AS books_this_week;

CREATE OR REPLACE VIEW public.model_usage_stats AS
SELECT
  generation_mode AS mode,
  COUNT(*) AS books,
  SUM(word_count) AS total_words,
  AVG(word_count)::INTEGER AS avg_words
FROM public.book_history
GROUP BY generation_mode
ORDER BY books DESC;

CREATE OR REPLACE VIEW public.daily_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS books,
  SUM(word_count) AS words,
  COUNT(DISTINCT user_id) AS users
FROM public.book_history
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW public.daily_ai_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_requests,
  COUNT(DISTINCT user_id) AS unique_users,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_usd_cents) / 100 AS total_cost_usd,
  SUM(word_count) AS total_words,
  COUNT(CASE WHEN task_type = 'module' THEN 1 END) AS chapter_generations,
  COUNT(CASE WHEN task_type = 'roadmap' THEN 1 END) AS roadmap_generations,
  COUNT(CASE WHEN success = FALSE THEN 1 END) AS failed_requests
FROM public.ai_usage
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW public.user_ai_stats AS
SELECT
  user_id,
  COUNT(*) AS total_requests,
  SUM(total_tokens) AS total_tokens_used,
  SUM(cost_usd_cents) / 100 AS total_cost_usd,
  SUM(word_count) AS total_words_generated,
  MIN(created_at) AS first_request,
  MAX(created_at) AS last_request,
  COUNT(DISTINCT DATE(created_at)) AS active_days
FROM public.ai_usage
WHERE success = TRUE
GROUP BY user_id
ORDER BY total_cost_usd DESC;

CREATE OR REPLACE VIEW public.ai_model_usage_stats AS
SELECT
  model_used,
  COUNT(*) AS total_calls,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_usd_cents) / 100 AS total_cost_usd,
  AVG(duration_ms) AS avg_duration_ms
FROM public.ai_usage
WHERE success = TRUE
GROUP BY model_used
ORDER BY total_calls DESC;

GRANT SELECT ON public.platform_stats TO authenticated;
GRANT SELECT ON public.model_usage_stats TO authenticated;
GRANT SELECT ON public.daily_stats TO authenticated;
GRANT SELECT ON public.daily_ai_stats TO authenticated;
GRANT SELECT ON public.user_ai_stats TO authenticated;
GRANT SELECT ON public.ai_model_usage_stats TO authenticated;

-- ============================================================================
-- STEP 8: BACKFILL PROFILES FOR ALREADY-EXISTING AUTH USERS
-- ============================================================================

INSERT INTO public.profiles (
  id,
  email,
  full_name,
  plan,
  plan_expires_at,
  books_created,
  total_words_generated
)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  'yearly',
  NOW() + INTERVAL '1 year',
  0,
  0
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ============================================================================
-- STEP 9: VERIFICATION
-- ============================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'book_history',
    'app_activity',
    'newsletter_subscribers',
    'ai_usage',
    'rate_limits'
  )
ORDER BY table_name;
