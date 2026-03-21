-- ============================================================================
-- COMPLETE FRESH DATABASE SETUP
-- Run this in Supabase SQL Editor - Drops everything and recreates from scratch
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EVERYTHING
-- ============================================================================

-- Drop views first
DROP VIEW IF EXISTS public.platform_stats CASCADE;
DROP VIEW IF EXISTS public.model_usage_stats CASCADE;
DROP VIEW IF EXISTS public.daily_stats CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS tr_protect_sensitive_columns ON public.profiles;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop all functions
DROP FUNCTION IF EXISTS public.protect_sensitive_columns() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.increment_books_created(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.record_book_started(text, text, text, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.record_book_completed(text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.record_book_completed(text, text, text, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.log_activity(text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.subscribe_newsletter(text) CASCADE;

-- Drop all tables
DROP TABLE IF EXISTS public.book_generations CASCADE;
DROP TABLE IF EXISTS public.app_activity CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================================
-- STEP 2: CREATE TABLES
-- ============================================================================

-- Profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  plan TEXT DEFAULT 'yearly',
  plan_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
  books_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book generations table (completed books only)
CREATE TABLE public.book_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  book_id TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT,
  generation_mode TEXT DEFAULT 'stellar',
  modules_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App activity log
CREATE TABLE public.app_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter subscribers
CREATE TABLE public.newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: CREATE FUNCTIONS
-- ============================================================================

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan, plan_expires_at, books_created)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'yearly',
    NOW() + INTERVAL '1 year',
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Increment books created
CREATE OR REPLACE FUNCTION public.increment_books_created(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles 
  SET books_created = books_created + 1,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record completed book with full details
CREATE OR REPLACE FUNCTION public.record_book_completed(
  p_book_id TEXT,
  p_title TEXT,
  p_goal TEXT,
  p_generation_mode TEXT,
  p_modules_count INTEGER,
  p_word_count INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.book_generations (
    user_id, book_id, title, goal, generation_mode, modules_count, word_count
  ) VALUES (
    v_user_id, p_book_id, p_title, p_goal, p_generation_mode, p_modules_count, p_word_count
  );

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Newsletter subscribe
CREATE OR REPLACE FUNCTION public.subscribe_newsletter(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.newsletter_subscribers (email)
  VALUES (p_email)
  ON CONFLICT (email) DO NOTHING;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: ENABLE RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Book generations policies
CREATE POLICY "Users read own books" ON public.book_generations
  FOR SELECT USING (auth.uid() = user_id);

-- App activity policies
CREATE POLICY "Users read own activity" ON public.app_activity
  FOR SELECT USING (auth.uid() = user_id);

-- Newsletter policies
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- STEP 5: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Table permissions
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.book_generations TO authenticated;
GRANT SELECT ON public.app_activity TO authenticated;
GRANT INSERT ON public.newsletter_subscribers TO anon;
GRANT INSERT ON public.newsletter_subscribers TO authenticated;

-- Function permissions
GRANT EXECUTE ON FUNCTION public.increment_books_created(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_book_completed(text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text) TO anon;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text) TO authenticated;

-- ============================================================================
-- STEP 6: CREATE STATS VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW public.platform_stats AS
SELECT
  (SELECT COUNT(*) FROM public.profiles) AS total_users,
  (SELECT COUNT(*) FROM public.book_generations) AS total_books,
  (SELECT COALESCE(SUM(word_count), 0) FROM public.book_generations) AS total_words,
  (SELECT COALESCE(AVG(word_count), 0)::INTEGER FROM public.book_generations) AS avg_words_per_book,
  (SELECT generation_mode FROM public.book_generations 
   GROUP BY generation_mode ORDER BY COUNT(*) DESC LIMIT 1) AS most_used_mode,
  (SELECT COUNT(*) FROM public.book_generations 
   WHERE created_at >= CURRENT_DATE) AS books_today,
  (SELECT COUNT(*) FROM public.book_generations 
   WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS books_this_week;

GRANT SELECT ON public.platform_stats TO authenticated;

CREATE OR REPLACE VIEW public.model_usage_stats AS
SELECT
  generation_mode AS mode,
  COUNT(*) AS books,
  SUM(word_count) AS total_words,
  AVG(word_count)::INTEGER AS avg_words
FROM public.book_generations
GROUP BY generation_mode
ORDER BY books DESC;

GRANT SELECT ON public.model_usage_stats TO authenticated;

CREATE OR REPLACE VIEW public.daily_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS books,
  SUM(word_count) AS words,
  COUNT(DISTINCT user_id) AS users
FROM public.book_generations
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;

GRANT SELECT ON public.daily_stats TO authenticated;

-- ============================================================================
-- DONE! Database is now fresh and ready.
-- NOTE: You'll need to create a new user account since profiles were deleted.
-- ============================================================================
