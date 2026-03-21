import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/notifications
 * 
 * Fetch recent notifications for the logged-in user
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const limitStr = searchParams.get('limit') || '50';
        const limit = parseInt(limitStr, 10);

        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('business_id', authUser.business_id)
            .eq('user_id', authUser.user_id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return errorResponse(error.message, 400);

        return successResponse(notifications);
    } catch (err) {
        console.error('Fetch notifications error:', err);
        return errorResponse('Internal server error', 500);
    }
}
