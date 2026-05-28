import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { calculateSuggestedQty } from '@/lib/order-guide-engine';

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
                ordered_by:        isBeingActioned ? authUser.user_id : task.ordered_by,
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
