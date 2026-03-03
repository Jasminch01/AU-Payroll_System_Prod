import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * POST /api/auth/logout
 * 
 * Sign out the current user
 * Access: Authenticated
 */
export async function POST() {
    try {
        const supabase = await createClient();

        const { error } = await supabase.auth.signOut();

        if (error) {
            return errorResponse(error.message, 400);
        }

        return successResponse(null, 'Logged out successfully');
    } catch (error) {
        console.error('Logout error:', error);
        return errorResponse('Internal server error', 500);
    }
}
