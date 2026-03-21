-- ============================================================================
-- Kitaab-AI Database Schema for Supabase
-- Run this in Supabase SQL Editor after creating your project
-- ============================================================================

-- User profiles with credits (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  credits INTEGER DEFAULT 3, -- Free tier: 3 credits for new users
  is_admin BOOLEAN DEFAULT FALSE,
  -- Subscription plan fields
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'yearly')),
  plan_expires_at TIMESTAMPTZ DEFAULT NULL, -- NULL for free tier, expiry date for paid plans
  books_created INTEGER DEFAULT 0, -- Total books created by user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit transactions (audit log for all credit changes)
CREATE TABLE public.credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL, -- positive = add credits, negative = use credits
  reason TEXT NOT NULL, -- 'manual_topup', 'book_generation', 'refund', 'bonus'
  payment_reference TEXT, -- UPI transaction ID for manual payments
  admin_notes TEXT,
  book_id TEXT, -- Reference to generated book (if applicable)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) -- admin who added (null for system)
);

-- Book generations log
CREATE TABLE public.book_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  book_id TEXT NOT NULL, -- Local book ID from the app
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, generating, completed, failed
  word_count INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- Auto-create profile on user signup with 1-year PRO subscription
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan, plan_expires_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'yearly', -- All new users get yearly PRO plan
    NOW() + INTERVAL '1 year' -- Expires 1 year from signup
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Auto-update updated_at timestamp
-- ============================================================================
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

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_generations ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Profiles: Users can update their own profile (except credits and is_admin)
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Credit Transactions: Users can read their own transactions
CREATE POLICY "Users read own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Book Generations: Users can read their own books
CREATE POLICY "Users read own books" ON public.book_generations
  FOR SELECT USING (auth.uid() = user_id);

-- Book Generations: Users can insert their own books
CREATE POLICY "Users insert own books" ON public.book_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Book Generations: Users can update their own books
CREATE POLICY "Users update own books" ON public.book_generations
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- Admin Policies (for you to manage credits)
-- ============================================================================

-- Admins can do everything on profiles
CREATE POLICY "Admins full access profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admins can do everything on credit_transactions
CREATE POLICY "Admins full access transactions" ON public.credit_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admins can do everything on book_generations
CREATE POLICY "Admins full access books" ON public.book_generations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================================================
-- Helper function to deduct credits (used by the app)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.use_credit(p_user_id UUID, p_book_id TEXT, p_title TEXT, p_goal TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- Get current credits
  SELECT credits INTO current_credits FROM public.profiles WHERE id = p_user_id;
  
  -- Check if user has credits
  IF current_credits IS NULL OR current_credits < 1 THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credit
  UPDATE public.profiles SET credits = credits - 1 WHERE id = p_user_id;
  
  -- Log the transaction
  INSERT INTO public.credit_transactions (user_id, amount, reason, book_id)
  VALUES (p_user_id, -1, 'book_generation', p_book_id);
  
  -- Log the book generation
  INSERT INTO public.book_generations (user_id, book_id, title, goal, status)
  VALUES (p_user_id, p_book_id, p_title, p_goal, 'generating');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper function to increment books_created (for paid plan users)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_books_created(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles 
  SET books_created = books_created + 1 
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SETUP INSTRUCTIONS:
-- 1. Create a new Supabase project at https://supabase.com
-- 2. Go to SQL Editor and run this entire script
-- 3. Go to Authentication > Providers and enable Email
-- 4. (Optional) Enable Google OAuth for social login
-- 5. Copy your project URL and anon key to your .env file
-- 6. Make yourself an admin by running:
--    UPDATE public.profiles SET is_admin = TRUE WHERE email = 'your@email.com';
-- ============================================================================
