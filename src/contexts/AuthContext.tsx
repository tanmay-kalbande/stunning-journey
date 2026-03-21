// src/contexts/AuthContext.tsx
// Authentication context for Kitaab-AI with Supabase
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    is_admin: boolean;
    created_at: string;
    plan: 'monthly' | 'yearly';
    plan_expires_at: string | null;
    books_created: number;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isSupabaseEnabled: boolean;
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signUp: (email: string, password: string, fullName?: string, profession?: string, learningInterest?: string) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    updateProfile: (data: { full_name?: string }) => Promise<{ error: Error | null }>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingTimedOut, setLoadingTimedOut] = useState(false);

    const isSupabaseEnabled = isSupabaseConfigured();

    const fetchProfile = useCallback(async (userId: string) => {
        if (!supabase) return null;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('❌ Error fetching profile:', error);
                return null;
            }
            return data as UserProfile;
        } catch (error) {
            console.error('❌ Exception fetching profile:', error);
            return null;
        }
    }, []);

    useEffect(() => {
        if (!supabase) {
            setIsLoading(false);
            return;
        }

        let mounted = true;
        const loadingTimeout = setTimeout(() => {
            if (mounted && isLoading) {
                setLoadingTimedOut(true);
                setIsLoading(false);
            }
        }, 5000);

        const initAuth = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) console.error('❌ Session retrieval error:', sessionError);

                if (!mounted) return;
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    const profileData = await fetchProfile(session.user.id);
                    if (mounted && profileData) setProfile(profileData);
                } else {
                    setProfile(null);
                }
            } catch (error) {
                console.error('Auth init error:', error);
            } finally {
                if (mounted) {
                    clearTimeout(loadingTimeout);
                    setIsLoading(false);
                }
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;
                if (event === 'INITIAL_SESSION') return;

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const profileData = await fetchProfile(session.user.id);
                    if (mounted && profileData) setProfile(profileData);
                } else {
                    setProfile(null);
                }
            }
        );

        return () => {
            mounted = false;
            clearTimeout(loadingTimeout);
            subscription.unsubscribe();
        };
    }, [fetchProfile]);

    const signIn = useCallback(async (email: string, password: string) => {
        if (!supabase) return { error: { message: 'Supabase not configured' } as AuthError };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    }, []);

    const signUp = useCallback(async (email: string, password: string, fullName?: string, profession?: string, learningInterest?: string) => {
        if (!supabase) return { error: { message: 'Supabase not configured' } as AuthError };

        // Sign up the user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName || '',
                    profession: profession || '',
                    learning_interest: learningInterest || ''
                }
            },
        });

        if (error) return { error };

        // Create profile in profiles table (don't rely on trigger)
        if (data.user) {
            try {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        email: email,
                        full_name: fullName || '',
                        profession: profession || '',
                        learning_interest: learningInterest || '',
                        plan: 'yearly',
                        plan_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        books_created: 0,
                        total_words_generated: 0
                    });

                if (profileError) {
                    console.error('[AUTH] Failed to create profile:', profileError);
                    // Don't fail signup if profile creation fails
                }
            } catch (err) {
                console.error('[AUTH] Exception creating profile:', err);
            }
        }

        return { error: null };
    }, []);

    const signOut = useCallback(async () => {
        if (!supabase) return;

        console.log('🔄 signOut initiated at:', new Date().toISOString());

        // 1. Immediately clear local React state to update UI instantly
        setUser(null);
        setProfile(null);
        setSession(null);

        try {
            // 2. Perform Supabase sign out
            // We don't await this to avoid blocking the UI, but we trigger it
            const { error } = await supabase.auth.signOut();
            if (error) console.error('❌ Supabase Sign out error:', error);
        } catch (error) {
            console.error('❌ Sign out exception:', error);
        }

        // 3. Purge ONLY auth-related storage
        // We PRESERVE 'pustakam-books' and 'checkpoint' keys so user data is NOT lost on logout
        try {
            const authKey = 'kitaab-auth';
            localStorage.removeItem(authKey);

            const keysToRemove: string[] = [authKey];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;

                // ONLY remove Supabase auth-related keys
                // DO NOT remove 'pustakam-books-' or 'checkpoint_' or 'pause_flag_'
                const isSupabaseAuthKey = key.startsWith('sb-') || key.includes('supabase-auth-token');

                if (isSupabaseAuthKey) {
                    keysToRemove.push(key);
                }
            }

            // Remove only identified auth keys
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Clear cookies (mainly for Supabase auth if used)
            document.cookie.split(";").forEach((c) => {
                document.cookie = c
                    .replace(/^ +/, "")
                    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            console.log('🧹 Purged authentication-specific data:', keysToRemove);
            console.log('💾 Preserved book data and progress indicators.');
        } catch (e) {
            console.warn('Failed to clear session cache:', e);
        }

        // 4. Force a clean transition by shifting to the landing page logic
        // (App.tsx handles navigation based on isAuthenticated)
    }, []); // Removed dependencies to avoid closure issues during logout state changes

    const updateProfile = useCallback(async (data: { full_name?: string }) => {
        if (!supabase || !user) return { error: new Error('Not authenticated') };
        const { error } = await supabase.from('profiles').update(data).eq('id', user.id);
        if (!error) {
            const profileData = await fetchProfile(user.id);
            if (profileData) setProfile(profileData);
        }
        return { error: error ? new Error(error.message) : null };
    }, [user, fetchProfile]);

    // Refresh the user's profile from Supabase (e.g., after book creation)
    const refreshProfile = useCallback(async () => {
        if (!supabase || !user) return;
        const profileData = await fetchProfile(user.id);
        if (profileData) setProfile(profileData);
    }, [user, fetchProfile]);

    const effectiveIsLoading = isLoading && !loadingTimedOut;

    const value: AuthContextType = {
        user,
        profile,
        isLoading: effectiveIsLoading,
        isAuthenticated: !!user,
        isSupabaseEnabled,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}

export default AuthContext;

interface AuthProviderProps {
    children: ReactNode;
}
