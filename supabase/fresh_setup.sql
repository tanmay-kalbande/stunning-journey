-- ============================================================================
-- KITAAB-AI COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor to set up everything from scratch
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING TABLES AND FUNCTIONS (CLEAN SLATE)
-- ============================================================================
DROP TRIGGER IF EXISTS tr_protect_sensitive_columns ON public.profiles;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.protect_sensitive_columns();
DROP FUNCTION IF EXISTS public.update_updated_at();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.increment_books_created(uuid);
DROP FUNCTION IF EXISTS public.start_book_generation(text, text, text);
DROP FUNCTION IF EXISTS public.use_credit(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.subscribe_newsletter(text);

DROP TABLE IF EXISTS public.book_generations CASCADE;
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================================
-- STEP 2: CREATE TABLES
-- ============================================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  plan TEXT DEFAULT 'yearly' CHECK (plan IN ('free', 'monthly', 'yearly')),
  plan_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
  books_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book generations log
CREATE TABLE public.book_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  book_id TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT DEFAULT 'generating',
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

-- Auto-create profile when a new user signs up
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

-- Trigger for auto-creating profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
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

-- Increment books_created (called by the app after book creation)
CREATE OR REPLACE FUNCTION public.increment_books_created(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles 
  SET books_created = books_created + 1,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Newsletter subscription
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
-- STEP 4: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Profiles: Users can update their own non-sensitive fields
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Book Generations: Users can read their own book generations
CREATE POLICY "Users read own book generations" ON public.book_generations
  FOR SELECT USING (auth.uid() = user_id);

-- Book Generations: Users can insert their own book generations  
CREATE POLICY "Users insert own book generations" ON public.book_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Newsletter: Anyone can insert (subscribe)
CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- STEP 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant table permissions
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.book_generations TO authenticated;
GRANT INSERT ON public.newsletter_subscribers TO anon;
GRANT INSERT ON public.newsletter_subscribers TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.increment_books_created(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text) TO anon;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text) TO authenticated;

-- ============================================================================
-- DONE! Your database is now ready.
-- ============================================================================
