import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * PATCH /api/notifications/read
 * 
 * Mark specific notifications (or all) as read.
 * Expected body: { notification_ids?: string[] }
 */
export async function PATCH(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json().catch(() => ({}));
        const { notification_ids } = body;

        const supabase = await createClient();

        if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
            // Mark specific IDs as read
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('business_id', authUser.business_id)
                .eq('user_id', authUser.user_id)
                .in('id', notification_ids);
                
            if (error) return errorResponse(error.message, 400);
        } else {
            // Mark ALL unread notifications as read
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('business_id', authUser.business_id)
                .eq('user_id', authUser.user_id)
                .eq('is_read', false);
                
            if (error) return errorResponse(error.message, 400);
        }

        return successResponse({ success: true }, 'Notifications marked as read');
    } catch (err) {
        console.error('Update notifications error:', err);
        return errorResponse('Internal server error', 500);
    }
}
