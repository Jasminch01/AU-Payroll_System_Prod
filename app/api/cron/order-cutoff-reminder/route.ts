import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { notifyOrderStatus } from '@/lib/order-guide-engine';
import { format } from 'date-fns';

/**
 * POST /api/cron/order-cutoff-reminder
 *
 * Runs every 30 minutes (via external cron trigger or Supabase pg_cron).
 * Finds categories whose cut-off time is within the next 30 minutes,
 * finds managers with pending orders in those categories,
 * and sends ORDER_CUTOFF_REMINDER notifications.
 *
 * Uses admin/service-role client — no user auth required.
 * Secured by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
    // Validate cron secret
    const secret = request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
        return errorResponse('Unauthorized', 401);
    }

    try {
        const supabase = createAdminClient();
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');

        // Current time as HH:MM for comparison
        const nowHHMM = format(now, 'HH:mm');
        // Window: now → now + 30 min
        const plusHHMM = format(new Date(now.getTime() + 30 * 60 * 1000), 'HH:mm');

        // Find categories with a cutoff_time in the next 30 minutes
        const { data: categories, error: catError } = await supabase
            .from('OrderCategory')
            .select('category_id, category_name, business_id, cutoff_time, responsible_role')
            .eq('is_active', true)
            .not('cutoff_time', 'is', null)
            .gte('cutoff_time', nowHHMM)
            .lte('cutoff_time', plusHHMM);

        if (catError) throw catError;
        if (!categories || categories.length === 0) {
            return successResponse({ notified: 0 }, 'No categories approaching cut-off');
        }

        let totalNotified = 0;

        for (const cat of categories) {
            // Find pending tasks in this category today
            const { data: pendingTasks } = await supabase
                .from('DailyOrderTask')
                .select('order_task_id')
                .eq('business_id', cat.business_id)
                .eq('category_id', cat.category_id)
                .eq('order_date', todayStr)
                .eq('order_status', 'pending');

            if (!pendingTasks || pendingTasks.length === 0) continue;

            // Find managers/owners in this business to notify
            let userRes: any = await supabase
                .from('User')
                .select('user_id, role, can_order_liquor')
                .eq('business_id', cat.business_id)
                .in('role', ['owner', 'manager']);

            if (userRes.error && userRes.error.message.includes('can_order_liquor')) {
                userRes = await supabase
                    .from('User')
                    .select('user_id, role')
                    .eq('business_id', cat.business_id)
                    .in('role', ['owner', 'manager']);
            }

            const users = userRes.data;

            if (!users) continue;

            for (const user of users) {
                // Skip managers without liquor permission for Liquor categories
                if (cat.category_name.toLowerCase().includes('liquor')) {
                    if (user.role !== 'owner' && !user.can_order_liquor) continue;
                }

                await notifyOrderStatus(
                    user.user_id,
                    cat.business_id,
                    'cutoff',
                    { pendingCount: pendingTasks.length, categories: [cat.category_name] }
                );
                totalNotified++;
            }
        }

        return successResponse({ notified: totalNotified }, `Sent ${totalNotified} cut-off reminder(s)`);
    } catch (err) {
        console.error('[cron/order-cutoff-reminder]', err);
        return errorResponse('Internal server error', 500);
    }
}
