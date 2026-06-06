import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * DEV ONLY: Simulate trial expiration by updating the auth user's created_at
 * to 11 days ago using Supabase Admin API.
 */
export async function POST() {
    try {
        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Set user created_at to 11 days ago using admin API
        const supabaseAdmin = createAdminClient();
        const elevenDaysAgo = new Date();
        elevenDaysAgo.setDate(elevenDaysAgo.getDate() - 11);

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            user_metadata: {
                ...user.user_metadata,
                original_created_at: user.created_at, // save original so we can restore later
                trial_expired_at: elevenDaysAgo.toISOString(),
            },
        });

        if (error) {
            console.error('Failed to update user metadata:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Trial simulated as expired. The SubscriptionGuard will now check trial_expired_at from user metadata.',
            expired_at: elevenDaysAgo.toISOString(),
        });

    } catch (error: any) {
        console.error('Dev expire-trial error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
