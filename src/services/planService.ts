// src/services/planService.ts
// Plan management service for Pustakam - All users have yearly plan

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import config from '../config';
import { PlanType, PLAN_CONFIG, isPlanActive, canCreateBook, getBooksRemaining } from '../types/plan';

// ============================================================================
// Types
// ============================================================================

export interface PlanStatus {
    plan: PlanType;
    planName: string;
    isActive: boolean;
    expiresAt: Date | null;
    booksCreated: number;
    booksRemaining: number;
    canCreate: boolean;
}

// ============================================================================
// Plan Service
// ============================================================================

export const planService = {
    /**
     * Get current plan status for the authenticated user
     */
    async getPlanStatus(): Promise<PlanStatus> {
        // Default yearly status for all users
        const defaultStatus: PlanStatus = {
            plan: 'yearly',
            planName: 'Yearly PRO',
            isActive: true,
            expiresAt: null,
            booksCreated: 0,
            booksRemaining: Infinity,
            canCreate: true,
        };

        if (!supabase || !isSupabaseConfigured()) {
            // Without Supabase, allow unlimited books (local-only mode)
            return defaultStatus;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return defaultStatus;
        }

        // Return infinite/free plan for everyone
        return {
            plan: 'yearly',
            planName: 'Yearly PRO',
            isActive: true, // Always active
            expiresAt: null, // Never expires
            booksCreated: 0, // We rely on specific book history counts usually, but for plan limits this is fine
            booksRemaining: Infinity,
            canCreate: true,
        };
    },

    /**
     * Increment books created count after successful book creation
     */
    async incrementBooksCreated(): Promise<boolean> {
        console.log('[PLAN] incrementBooksCreated called');

        if (!supabase || !isSupabaseConfigured()) {
            console.log('[PLAN] Supabase not configured, skipping');
            return true; // Allow in local mode
        }

        try {
            // First check if we have a session
            const { data: sessionData } = await supabase.auth.getSession();
            console.log('[PLAN] Session check:', sessionData?.session ? 'Active session found' : 'NO SESSION');

            if (!sessionData?.session) {
                console.warn('[PLAN] ⚠️ No active session - user may need to re-authenticate');
                return false;
            }

            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError) {
                console.error('[PLAN] getUser error:', userError.message);
                return false;
            }

            if (!user) {
                console.log('[PLAN] No authenticated user despite having session');
                return false;
            }

            console.log('[PLAN] Calling increment_books_created RPC for user:', user.id);

            const { error } = await supabase.rpc('increment_books_created', {
                p_user_id: user.id,
            });

            if (error) {
                console.error('[PLAN] RPC failed:', error.message, error.code, error.details);
                return false;
            }

            console.log('[PLAN] ✅ Books count incremented successfully');
            return true;
        } catch (err) {
            console.error('[PLAN] Exception:', err);
            return false;
        }
    },

    /**
     * Check if user can create a book - always allowed for all plans
     */
    async checkCanCreateBook(): Promise<{ allowed: boolean; message?: string }> {
        const status = await this.getPlanStatus();

        if (status.canCreate) {
            return { allowed: true };
        }

        if (!status.isActive) {
            return {
                allowed: false,
                message: 'Your plan has expired. Please renew to continue creating books.',
            };
        }

        return { allowed: true };
    },

    /**
     * Synchronize local books count with Supabase
     */
    async syncBooksCount(count: number): Promise<boolean> {
        if (!supabase || !isSupabaseConfigured()) {
            return false;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Only update if the local count is higher than what's in the DB
        // or to ensure consistency on first login
        const { data: profile } = await supabase
            .from('profiles')
            .select('books_created')
            .eq('id', user.id)
            .single();

        if (profile && (profile.books_created || 0) < count) {
            const { error } = await supabase
                .from('profiles')
                .update({ books_created: count })
                .eq('id', user.id);

            return !error;
        }

        return false;
    },

    /**
     * Record completed book in Supabase with full details
     */
    async recordBookCompleted(
        bookId: string,
        title: string,
        goal: string,
        generationMode: string,
        modulesCount: number,
        wordCount: number
    ): Promise<boolean> {
        console.log('[PLAN] recordBookCompleted called with:', { bookId, title, generationMode, modulesCount, wordCount });

        if (!config.isSupabaseConfigured) {
            console.log('[PLAN] Supabase not configured for book tracking');
            return true;
        }

        try {
            // 1. Get the authenticated user and token manually from localStorage
            let token: string | null = null;
            let finalUserId: string | null = null; // Initialize as null, will be set from auth or books key
            let userEmail = '';
            let userName = '';

            try {
                const authData = localStorage.getItem('kitaab-auth');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    token = parsed?.access_token;
                    finalUserId = parsed?.user?.id;
                    userEmail = parsed?.user?.email || '';
                    userName = parsed?.user?.user_metadata?.full_name || '';
                    console.log('[PLAN] Found valid session in kitaab-auth');
                } else {
                    const keys = Object.keys(localStorage);
                    const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                    if (authKey) {
                        const parsed = JSON.parse(localStorage.getItem(authKey) || '{}');
                        token = parsed?.access_token;
                        finalUserId = parsed?.user?.id;
                        userEmail = parsed?.user?.email || '';
                        userName = parsed?.user?.user_metadata?.full_name || '';
                        console.log('[PLAN] Found valid session in sb-* key');
                    }
                }
            } catch (e) {
                console.warn('[PLAN] Error parsing auth tokens:', e);
            }

            if (!finalUserId) {
                const keys = Object.keys(localStorage);
                const booksKey = keys.find(k => k.startsWith('pustakam-books-') && k !== 'pustakam-books');
                if (booksKey) {
                    finalUserId = booksKey.replace('pustakam-books-', '');
                    console.log('[PLAN] Extracted userId from books key (no token available):', finalUserId);
                }
            }

            if (!finalUserId) {
                console.log('[PLAN] No userId found, skipping recording');
                return false;
            }

            // Headers for all requests
            const headers = {
                'apikey': config.supabase.anonKey,
                'Authorization': token ? `Bearer ${token}` : `Bearer ${config.supabase.anonKey}`,
                'Content-Type': 'application/json'
            };

            const profileUrl = `${config.supabase.url}/rest/v1/profiles?id=eq.${finalUserId}&select=id,books_created,total_words_generated`;
            const bookHistoryUrl = `${config.supabase.url}/rest/v1/book_history`;

            console.log('[PLAN] Ensuring profile exists for user:', finalUserId);

            // A chain of fetch calls: Check Profile -> Create if missing -> Insert Book -> Update Profile Stats
            fetch(profileUrl, { method: 'GET', headers })
                .then(async (profileRes) => {
                    if (!profileRes.ok) throw new Error(`Profile check failed: ${profileRes.statusText}`);
                    const profiles = await profileRes.json();

                    // If profile missing, create it first
                    if (!profiles || profiles.length === 0) {
                        console.warn('[PLAN] Profile missing in DB, creating on-the-fly...');
                        const createProfilePayload = {
                            id: finalUserId,
                            email: userEmail,
                            full_name: userName || 'User',
                            plan: 'yearly',
                            books_created: 0,
                            total_words_generated: 0
                        };
                        const createRes = await fetch(`${config.supabase.url}/rest/v1/profiles`, {
                            method: 'POST',
                            headers: { ...headers, 'Prefer': 'return=minimal' },
                            body: JSON.stringify(createProfilePayload)
                        });
                        if (!createRes.ok) throw new Error(`Failed to create missing profile: ${createRes.statusText}`);
                        console.log('[PLAN] ✅ Profile created successfully');
                        return { books_created: 0, total_words_generated: 0 };
                    }

                    return profiles[0];
                })
                .then(async (currentProfile) => {
                    // Now insert the book history record
                    console.log('[PLAN] Inserting book history record...');
                    const bookPayload = {
                        user_id: finalUserId,
                        book_id: bookId,
                        title,
                        goal,
                        generation_mode: generationMode,
                        modules_count: modulesCount,
                        word_count: wordCount
                    };

                    const bookRes = await fetch(bookHistoryUrl, {
                        method: 'POST',
                        headers: { ...headers, 'Prefer': 'return=minimal' },
                        body: JSON.stringify(bookPayload)
                    });

                    if (!bookRes.ok) {
                        const err = await bookRes.text();
                        console.error('[PLAN] ❌ Book History Insert Failed:', err);
                        throw new Error(`Book history insert failed: ${bookRes.statusText}`);
                    }

                    console.log('[PLAN] ✅ Book recorded in book_history!');

                    // Finally update profile stats
                    const updatePayload = {
                        books_created: (currentProfile.books_created || 0) + 1,
                        total_words_generated: (currentProfile.total_words_generated || 0) + wordCount
                    };

                    const updateRes = await fetch(`${config.supabase.url}/rest/v1/profiles?id=eq.${finalUserId}`, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify(updatePayload)
                    });

                    if (updateRes.ok) {
                        console.log('[PLAN] ✅ Profile stats updated successfully!');
                    } else {
                        console.warn('[PLAN] ❌ Profile stats update failed:', updateRes.statusText);
                    }
                })
                .catch((err) => {
                    console.error('[PLAN] ❌ Error in recordBookCompleted flow:', err);
                });

            return true;
        } catch (err) {
            console.error('[PLAN] Critical exception in recordBookCompleted:', err);
            return false;
        }
    },
};

export default planService;
