// src/config.ts
// Clean configuration - centralized environment variables
// IMPORTANT: Vite only exposes env vars prefixed with VITE_ to the client bundle

export const config = {
    // Supabase
    supabase: {
        url: import.meta.env.VITE_SUPABASE_URL || '',
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        // NOTE: The anon key is safe to expose in the browser IF AND ONLY IF 
        // Row Level Security (RLS) is properly configured on the Supabase dashboard.
    },

    // Contact
    contact: {
        whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER || '919876543210',
        supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'hello@tanmaysk.in',
    },

    // Computed
    get isSupabaseConfigured() {
        return !!(this.supabase.url && this.supabase.anonKey);
    },
};


export default config;
