import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('OrderGuideItem')
            .select(`*, category:OrderCategory(*), supplier:OrderSupplier(*)`)
            .eq('item_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!data)  return errorResponse('Item not found', 404);

        return successResponse(data);
    } catch (err) {
        console.error('[order-guide-items/:id GET]', err);
        return errorResponse('Internal server error', 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        const min = body.min_stock_qty !== undefined ? Number(body.min_stock_qty) : undefined;
        const max = body.max_stock_qty !== undefined ? Number(body.max_stock_qty) : undefined;

        if (min !== undefined && max !== undefined && max < min) {
            return errorResponse('max_stock_qty must be >= min_stock_qty', 400);
        }

        const { data, error } = await supabase
            .from('OrderGuideItem')
            .update({
                category_id:          body.category_id,
                supplier_id:          body.supplier_id,
                product_name:         body.product_name,
                min_stock_qty:        min,
                max_stock_qty:        max,
                default_order_qty:    body.default_order_qty,
                unit:                 body.unit,
                order_frequency:      body.order_frequency,
                order_days:           body.order_days,
                ordering_method:      body.ordering_method,
                ordering_instruction: body.ordering_instruction,
                comment:              body.comment,
                is_active:            body.is_active,
                sort_order:           body.sort_order,
            })
            .eq('item_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!data)  return errorResponse('Item not found', 404);

        return successResponse(data, 'Item updated successfully');
    } catch (err) {
        console.error('[order-guide-items/:id PATCH]', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE — soft delete (is_active = false).
 * Preserves historical DailyOrderTask records.
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        // 1. Delete associated DailyOrderTask records
        await supabase
            .from('DailyOrderTask')
            .delete()
            .eq('item_id', id)
            .eq('business_id', authUser.business_id);

        // 2. Delete the item itself
        const { data, error } = await supabase
            .from('OrderGuideItem')
            .delete()
            .eq('item_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!data)  return errorResponse('Item not found', 404);

        return successResponse(null, 'Item deleted successfully');
    } catch (err) {
        console.error('[order-guide-items/:id DELETE]', err);
        return errorResponse('Internal server error', 500);
    }
}
