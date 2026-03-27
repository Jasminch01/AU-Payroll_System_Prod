import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * POST /api/notifications/subscribe
 * 
 * Save search subscription for push notifications
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        // If the user isn't logged in yet, gracefully accept but don't database it until they log in.
        // The frontend will re-sync the subscription natively upon login.
        if (!authUser) {
             return successResponse({ message: 'Anonymous subscription request acknowledged.' });
        }

        const body = await request.json();
        const { subscription } = body;

        if (!subscription) {
            return errorResponse('Subscription is required', 400);
        }

        const supabase = await createClient();

        // Save subscription to the database
        // Table should have: user_id (uuid), subscription (jsonb)
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: authUser.user_id,
                subscription: subscription,
            }, {
                onConflict: 'user_id,subscription'
            });

        if (error) {
            console.error('Save subscription error:', error);
            return errorResponse(error.message, 400);
        }

        return successResponse({ message: 'Subscribed successfully' });
    } catch (err) {
        console.error('Push subscribe error:', err);
        return errorResponse('Internal server error', 500);
    }
}
