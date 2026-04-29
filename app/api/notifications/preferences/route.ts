import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/notifications/preferences
 * 
 * Fetch notification preferences for the current user
 */
export async function GET() {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();
        
        // Try to fetch from UserNotificationPreference table
        const { data: preferences, error } = await supabase
            .from('UserNotificationPreference')
            .select('type, is_enabled')
            .eq('user_id', authUser.user_id);

        if (error) {
            // If table doesn't exist yet, return empty array (defaults will be used)
            console.warn('UserNotificationPreference table might not exist:', error.message);
            return successResponse([]);
        }

        return successResponse(preferences || []);
    } catch (err) {
        console.error('Fetch preferences error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PATCH /api/notifications/preferences
 * 
 * Update notification preferences
 * Body: { type: string, is_enabled: boolean }
 */
export async function PATCH(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const { type, is_enabled } = body;

        if (!type) return errorResponse('Notification type is required', 400);

        const supabase = await createClient();

        // Upsert the preference
        const { error } = await supabase
            .from('UserNotificationPreference')
            .upsert({
                user_id: authUser.user_id,
                business_id: authUser.business_id,
                type,
                is_enabled,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,type'
            });

        if (error) {
            console.error('Update preference error:', error);
            return errorResponse(error.message, 400);
        }

        return successResponse(null, 'Preference updated');
    } catch (err) {
        console.error('Update preference error:', err);
        return errorResponse('Internal server error', 500);
    }
}
