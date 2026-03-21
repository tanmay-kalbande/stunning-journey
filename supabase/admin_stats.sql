-- ============================================================================
-- ADMIN STATS VIEW
-- Run this in Supabase SQL Editor to create a stats dashboard view
-- ============================================================================

-- Create a view that aggregates platform-wide statistics
CREATE OR REPLACE VIEW public.platform_stats AS
SELECT
  -- Total Users
  (SELECT COUNT(*) FROM public.profiles) AS total_users,
  
  -- Total Books Generated
  (SELECT COUNT(*) FROM public.book_generations) AS total_books_generated,
  
  -- Completed Books
  (SELECT COUNT(*) FROM public.book_generations WHERE status = 'completed') AS completed_books,
  
  -- In Progress Books
  (SELECT COUNT(*) FROM public.book_generations WHERE status = 'generating') AS in_progress_books,
  
  -- Total Words Generated (all users)
  (SELECT COALESCE(SUM(word_count), 0) FROM public.book_generations) AS total_words_generated,
  
  -- Average Words Per Book
  (SELECT COALESCE(AVG(word_count), 0)::INTEGER FROM public.book_generations WHERE status = 'completed') AS avg_words_per_book,
  
  -- Most Used Generation Mode
  (SELECT generation_mode FROM public.book_generations 
   GROUP BY generation_mode ORDER BY COUNT(*) DESC LIMIT 1) AS most_used_mode,
  
  -- Books Today
  (SELECT COUNT(*) FROM public.book_generations 
   WHERE created_at >= CURRENT_DATE) AS books_today,
  
  -- Books This Week
  (SELECT COUNT(*) FROM public.book_generations 
   WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS books_this_week,
  
  -- Books This Month
  (SELECT COUNT(*) FROM public.book_generations 
   WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') AS books_this_month,
  
  -- Active Users (created book in last 7 days)
  (SELECT COUNT(DISTINCT user_id) FROM public.book_generations 
   WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS active_users_7d,
  
  -- Last Updated
  NOW() AS stats_generated_at;

-- Grant access to authenticated users (you can restrict this to admins if needed)
GRANT SELECT ON public.platform_stats TO authenticated;

-- ============================================================================
-- MODEL USAGE STATS VIEW
-- Shows breakdown of AI model/mode usage
-- ============================================================================

CREATE OR REPLACE VIEW public.model_usage_stats AS
SELECT
  generation_mode,
  COUNT(*) AS books_count,
  SUM(word_count) AS total_words,
  AVG(word_count)::INTEGER AS avg_words,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
  COUNT(CASE WHEN status = 'generating' THEN 1 END) AS in_progress,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed
FROM public.book_generations
GROUP BY generation_mode
ORDER BY books_count DESC;

GRANT SELECT ON public.model_usage_stats TO authenticated;

-- ============================================================================
-- DAILY STATS VIEW
-- Shows daily breakdown of book generation
-- ============================================================================

CREATE OR REPLACE VIEW public.daily_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS books_started,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) AS books_completed,
  SUM(word_count) AS words_generated,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.book_generations
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;

GRANT SELECT ON public.daily_stats TO authenticated;

-- ============================================================================
-- HOW TO USE:
-- 
-- In Supabase Table Editor, you can now open these views:
-- 1. platform_stats    - Overall platform metrics (single row)
-- 2. model_usage_stats - Breakdown by generation mode
-- 3. daily_stats       - Daily activity for last 30 days
--
-- Or query them directly:
-- SELECT * FROM platform_stats;
-- SELECT * FROM model_usage_stats;
-- SELECT * FROM daily_stats;
-- ============================================================================
