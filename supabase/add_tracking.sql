-- ============================================================================
-- SIMPLIFIED BOOK TRACKING (Completed Books Only)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Drop old functions
DROP FUNCTION IF EXISTS public.record_book_started(text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.record_book_completed(text, integer);

-- ============================================================================
-- UPDATE BOOK_GENERATIONS TABLE (simplified - completed books only)
-- ============================================================================

DROP TABLE IF EXISTS public.book_generations CASCADE;

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

-- Enable RLS
ALTER TABLE public.book_generations ENABLE ROW LEVEL SECURITY;

-- Users can read their own book generations
CREATE POLICY "Users read own book generations" ON public.book_generations
  FOR SELECT USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT ON public.book_generations TO authenticated;

-- ============================================================================
-- RECORD COMPLETED BOOK FUNCTION
-- ============================================================================

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

  -- Insert completed book record
  INSERT INTO public.book_generations (
    user_id, book_id, title, goal, generation_mode, modules_count, word_count
  ) VALUES (
    v_user_id, p_book_id, p_title, p_goal, p_generation_mode, p_modules_count, p_word_count
  );

  -- Log activity
  INSERT INTO public.app_activity (user_id, activity_type, metadata)
  VALUES (v_user_id, 'book_completed', jsonb_build_object(
    'book_id', p_book_id,
    'title', p_title,
    'mode', p_generation_mode,
    'modules', p_modules_count,
    'words', p_word_count
  ));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant function permission
GRANT EXECUTE ON FUNCTION public.record_book_completed(text, text, text, text, integer, integer) TO authenticated;

-- ============================================================================
-- ADMIN STATS VIEW (Updated)
-- ============================================================================

DROP VIEW IF EXISTS public.platform_stats;
DROP VIEW IF EXISTS public.model_usage_stats;
DROP VIEW IF EXISTS public.daily_stats;

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
   WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS books_this_week,
  (SELECT COUNT(DISTINCT user_id) FROM public.book_generations 
   WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS active_users_7d,
  NOW() AS updated_at;

GRANT SELECT ON public.platform_stats TO authenticated;

-- Mode usage breakdown
CREATE OR REPLACE VIEW public.model_usage_stats AS
SELECT
  generation_mode AS mode,
  COUNT(*) AS books,
  SUM(word_count) AS total_words,
  AVG(word_count)::INTEGER AS avg_words,
  SUM(modules_count) AS total_modules
FROM public.book_generations
GROUP BY generation_mode
ORDER BY books DESC;

GRANT SELECT ON public.model_usage_stats TO authenticated;

-- Daily stats
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
-- DONE! Views available:
-- - platform_stats: Overall metrics
-- - model_usage_stats: Breakdown by mode (stellar/blackhole)
-- - daily_stats: Daily activity for last 30 days
-- ============================================================================
