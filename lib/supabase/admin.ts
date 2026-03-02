import { createClient } from '@supabase/supabase-js';

// Admin client — uses service role key, bypasses RLS
// Use ONLY in server-side API routes for admin operations like:
// - Creating employee auth accounts (admin.createUser)
// - Inviting managers
// - Bulk operations
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}

export { createClient };
