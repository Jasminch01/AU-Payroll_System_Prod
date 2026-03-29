import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * POST /api/notifications/subscribe
 * 
 * Save push subscription for the authenticated user's device.
 * Uses the push endpoint as a logical device identifier.
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        // If the user isn't logged in yet, gracefully accept but don't database it until they log in.
        // The frontend will re-sync the subscription natively upon login.
        if (!authUser) {
            return errorResponse('Authentication required to subscribe to push notifications', 401);
        }

        const body = await request.json();
        const { subscription } = body;

        if (!subscription || !subscription.endpoint) {
            return errorResponse('Valid subscription with endpoint is required', 400);
        }

        const supabase = await createClient();
        const endpoint = subscription.endpoint;

        // Delete any existing entry for this exact device endpoint to avoid duplicates,
        // then insert fresh. This handles both re-registrations and stale subscription cleanup.
        await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', authUser.user_id)
            .eq('endpoint', endpoint);

        const { error } = await supabase
            .from('push_subscriptions')
            .insert({
                user_id: authUser.user_id,
                subscription: subscription,
                endpoint: endpoint,
            });

        if (error) {
            console.error('Save subscription error:', error);
            // Fallback: if the endpoint column doesn't exist yet, try inserting without it
            const { error: fallbackError } = await supabase
                .from('push_subscriptions')
                .insert({
                    user_id: authUser.user_id,
                    subscription: subscription,
                });
            if (fallbackError) {
                console.error('Fallback subscription save error:', fallbackError);
                return errorResponse(fallbackError.message, 400);
            }
        }

        return successResponse({ message: 'Subscribed successfully' });
    } catch (err) {
        console.error('Push subscribe error:', err);
        return errorResponse('Internal server error', 500);
    }
}