-- ============================================================================
-- SECURITY UPDATES (Run this in Supabase SQL Editor)
-- Purpose: Move credit logic to server-side and lock down profile updates
-- ============================================================================

-- 1. Create a secure "Gatekeeper" function for book generation
-- This replaces the client-side checks and ensures atomic credit deduction
CREATE OR REPLACE FUNCTION public.start_book_generation(
  p_book_id TEXT,
  p_title TEXT,
  p_goal TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_has_access BOOLEAN;
  v_deduct_amount INTEGER;
  v_result JSONB;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Lock the profile row for update to prevent race conditions
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Determine access rights
  v_has_access := FALSE;
  v_deduct_amount := 0;

  -- Check for active paid plan (monthly/yearly)
  IF (v_profile.plan IN ('monthly', 'yearly')) AND 
     (v_profile.plan_expires_at IS NULL OR v_profile.plan_expires_at > NOW()) THEN
    v_has_access := TRUE;
    v_deduct_amount := 0; -- Free for paid plans
  -- Check for credits if no paid plan
  ELSIF v_profile.credits >= 1 THEN
    v_has_access := TRUE;
    v_deduct_amount := 1;
  END IF;

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Execute Transaction
  -- 1. Deduct credits if needed
  IF v_deduct_amount > 0 THEN
    UPDATE public.profiles 
    SET credits = credits - v_deduct_amount,
        books_created = books_created + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Log credit transaction
    INSERT INTO public.credit_transactions (user_id, amount, reason, book_id)
    VALUES (v_user_id, -v_deduct_amount, 'book_generation', p_book_id);
  ELSE
    -- Just increment count for paid users
    UPDATE public.profiles 
    SET books_created = books_created + 1,
        updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- 2. Log the book generation (Secure Insert)
  -- This bypasses RLS because we are in a SECURITY DEFINER function
  INSERT INTO public.book_generations (user_id, book_id, title, goal, status, credits_used)
  VALUES (v_user_id, p_book_id, p_title, p_goal, 'generating', v_deduct_amount);

  -- Return success with remaining credits
  RETURN jsonb_build_object(
    'success', true, 
    'remainingCredits', (v_profile.credits - v_deduct_amount) -- Rough estimate, accurate enough for UI
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Lock down the tables (Revoke redundant permissions)

-- Revoke direct INSERT access to book_generations (Force use of RPC)
-- Note: 'authenticated' role is what logged-in users use
REVOKE INSERT ON public.book_generations FROM authenticated;
REVOKE INSERT ON public.book_generations FROM anon;

-- 3. TIGHTEN RLS ON PROFILES
-- Prevent users from updating their own credits/plan directly
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile common fields" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    -- Only allow updating harmless fields (add more if needed, e.g. avatars)
    -- This relies on the fact that an UPDATE query must NOT touch columns not mentioned?
    -- Actually, Supabase/Postgres RLS 'WITH CHECK' validates the *resulting* row.
    -- To strictly prevent column updates, we separate permissions or use a trigger.
    -- For simplicity/robustness here, we'll use a TRIGGER to block restricted column changes.
  );

-- Create a trigger to protect sensitive columns
CREATE OR REPLACE FUNCTION public.protect_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- If checking against "authenticated" role (standard user)
  IF (auth.role() = 'authenticated') AND (current_user != 'postgres') THEN
    -- Check if sensitive columns are changing
    IF (NEW.credits IS DISTINCT FROM OLD.credits) OR
       (NEW.plan IS DISTINCT FROM OLD.plan) OR
       (NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at) OR
       (NEW.is_admin IS DISTINCT FROM OLD.is_admin) OR
       (NEW.books_created IS DISTINCT FROM OLD.books_created) THEN
       
      RAISE EXCEPTION 'You are not authorized to update credits or plan details directly.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_sensitive_columns ON public.profiles;
CREATE TRIGGER tr_protect_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_sensitive_columns();


-- 4. Cleanup old/unused functions if preferred
DROP FUNCTION IF EXISTS public.use_credit(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.increment_books_created(uuid);
