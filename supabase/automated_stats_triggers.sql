-- ============================================================================
-- AUTOMATED STATS TRIGGERS
-- Run this AFTER running your main schema setup
-- This creates a trigger that updates platform_stats when books are recorded
-- ============================================================================

-- 1. Trigger function to handle all stats updates on book_history insert
CREATE OR REPLACE FUNCTION public.sync_book_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update platform-wide stats
    UPDATE public.platform_stats
    SET 
        total_books_generated = total_books_generated + 1,
        total_words_generated = total_words_generated + COALESCE(NEW.word_count, 0),
        updated_at = NOW()
    WHERE id = 1;

    -- Update individual user profile stats
    UPDATE public.profiles
    SET 
        books_created = COALESCE(books_created, 0) + 1,
        total_words_generated = COALESCE(total_words_generated, 0) + COALESCE(NEW.word_count, 0),
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to book_history (drop first if exists)
DROP TRIGGER IF EXISTS on_book_recorded ON public.book_history;
CREATE TRIGGER on_book_recorded
    AFTER INSERT ON public.book_history
    FOR EACH ROW EXECUTE FUNCTION public.sync_book_stats();

-- 3. Initialize platform_stats if empty
INSERT INTO public.platform_stats (id, total_books_generated, total_words_generated, total_users, updated_at)
VALUES (1, 0, 0, 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.sync_book_stats() TO authenticated;

-- ============================================================================
-- VERIFICATION: After running this, insert a test row into book_history:
-- INSERT INTO book_history (user_id, book_id, title, word_count) 
-- VALUES ('your-user-uuid', 'test-book-1', 'Test Book', 5000);
-- 
-- Then check: SELECT * FROM platform_stats;
-- The counts should have increased!
-- ============================================================================
