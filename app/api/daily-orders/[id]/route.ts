import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { calculateSuggestedQty } from '@/lib/order-guide-utils';

/**
 * PATCH /api/daily-orders/[id]
 * Update a single DailyOrderTask — current stock, final qty, order status.
 * This is the main endpoint the ordering UI calls when a manager
 * enters stock quantities and marks items as Ordered / Not Required / Issue.
 *
 * Access: Owner, Manager
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager', 'employee');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        // Check if employee is clocked in and assigned to ordering tasks
        if (authUser.role === 'employee') {
            if (!authUser.employee_id) {
                return errorResponse('Valid employee profile required.', 401);
            }
            const { data: lastLog } = await supabase
                .from('AttendanceLog')
                .select('event_type')
                .eq('employee_id', authUser.employee_id)
                .order('timestamp', { ascending: false })
                .limit(1)
                .maybeSingle();

            const isClockedIn = lastLog && (lastLog.event_type === 'CLOCK_IN' || lastLog.event_type === 'BREAK_END');
            if (!isClockedIn) {
                return errorResponse('Access Denied: You must clock in for your shift before you can update stock counts or complete tasks.', 403);
            }

            // Check roster assignment and ordering responsibilities
            const { getBusinessTimezone } = await import('@/lib/auth');
            const { getDateInTimezone } = await import('@/lib/timezone-utils');
            const { detectShiftHasOrdering } = await import('@/lib/order-guide-engine');

            const timezone = await getBusinessTimezone(authUser.business_id);
            const today = getDateInTimezone(new Date().toISOString(), timezone);

            const { data: shift } = await supabase
                .from('Shift')
                .select('shift_id')
                .eq('employee_id', authUser.employee_id)
                .eq('shift_date', today)
                .eq('shift_status', 'published')
                .limit(1)
                .maybeSingle();

            if (!shift) {
                return errorResponse('Access Denied: You do not have a published rostered shift today.', 403);
            }

            const hasOrdering = await detectShiftHasOrdering(shift.shift_id, supabase);
            if (!hasOrdering) {
                return errorResponse('Access Denied: You are not assigned to ordering tasks for today.', 403);
            }
        }

        // Load existing task + item for suggested qty recalculation
        const { data: task, error: fetchError } = await supabase
            .from('DailyOrderTask')
            .select(`
                *,
                item:OrderGuideItem(min_stock_qty, max_stock_qty, default_order_qty)
            `)
            .eq('order_task_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (fetchError) return errorResponse(fetchError.message, 400);
        if (!task)      return errorResponse('Order task not found', 404);

        // Validate: Issue requires a reason
        if (body.order_status === 'issue' && !body.comment_reason?.trim()) {
            return errorResponse('A reason is required when marking an order as Issue', 400);
        }

        // Auto-calculate suggested qty when current_stock_qty is provided
        let suggested_qty = task.suggested_qty;
        let stock_status  = task.stock_status;

        if (body.current_stock_qty !== undefined && task.item) {
            const calc = calculateSuggestedQty(
                task.item as any,
                Number(body.current_stock_qty)
            );
            suggested_qty = calc.suggestedQty;
            stock_status  = calc.stockStatus;
        }

        const isBeingActioned = body.order_status && body.order_status !== 'pending';

        const { data: updated, error: updateError } = await supabase
            .from('DailyOrderTask')
            .update({
                current_stock_qty: body.current_stock_qty  ?? task.current_stock_qty,
                final_qty:         body.final_qty          ?? task.final_qty,
                suggested_qty,
                stock_status,
                order_status:      body.order_status       ?? task.order_status,
                comment_reason:    body.comment_reason     ?? task.comment_reason,
                order_reference:   body.order_reference    ?? task.order_reference,
                ordered_by:        isBeingActioned && authUser.role !== 'employee' ? authUser.user_id : task.ordered_by,
                ordered_at:        isBeingActioned ? new Date().toISOString() : task.ordered_at,
            })
            .eq('order_task_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (updateError) return errorResponse(updateError.message, 400);

        return successResponse(updated, 'Order task updated');
    } catch (err) {
        console.error('[daily-orders/:id PATCH]', err);
        return errorResponse('Internal server error', 500);
    }
}
