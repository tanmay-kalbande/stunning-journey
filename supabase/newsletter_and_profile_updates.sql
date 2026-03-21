-- ============================================================================
-- Newsletter Subscribers Table & Profile Updates
-- Run this in Supabase SQL Editor to add newsletter functionality
-- and update user profiles with new signup fields
-- ============================================================================

-- Newsletter subscribers table
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'landing_page', -- where they signed up from
  is_active BOOLEAN DEFAULT TRUE, -- for unsubscribe functionality
  unsubscribed_at TIMESTAMPTZ DEFAULT NULL
);

-- Add new columns to profiles table for enhanced signup
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profession TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS learning_interest TEXT DEFAULT NULL;

-- ============================================================================
-- RLS Policies for newsletter_subscribers
-- ============================================================================

-- Enable RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (insert their own email)
CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

-- Users cannot read other subscribers (admins only)
CREATE POLICY "Admins can read subscribers" ON public.newsletter_subscribers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admins can update/delete subscribers
CREATE POLICY "Admins full access subscribers" ON public.newsletter_subscribers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================================================
-- Update handle_new_user function to include new fields
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, credits, profession, learning_interest)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    3, -- Free tier: 3 credits for new users
    NEW.raw_user_meta_data->>'profession',
    NEW.raw_user_meta_data->>'learning_interest'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Newsletter subscribe function (can be called from client)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.subscribe_newsletter(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.newsletter_subscribers (email)
  VALUES (LOWER(TRIM(p_email)))
  ON CONFLICT (email) 
  DO UPDATE SET 
    is_active = TRUE,
    unsubscribed_at = NULL;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INSTRUCTIONS:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. This will create the newsletter_subscribers table
-- 3. This will add profession and learning_interest to profiles
-- 4. The handle_new_user function is updated to save new signup fields
-- ============================================================================
