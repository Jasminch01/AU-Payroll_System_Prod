import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/order-categories/[id]
 * Returns category detail with all its active products.
 * Access: Owner, Manager (Liquor filtered by permission)
 */
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
            .from('OrderCategory')
            .select(`
                *,
                supplier:OrderSupplier(*),
                items:OrderGuideItem(
                    *,
                    supplier:OrderSupplier(supplier_id, supplier_name)
                )
            `)
            .eq('category_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!data)  return errorResponse('Category not found', 404);

        // Liquor guard
        if (
            data.category_name.toLowerCase().includes('liquor') &&
            authUser.role !== 'owner' &&
            !authUser.can_order_liquor
        ) {
            return errorResponse('Access denied to Liquor category', 403);
        }

        // Sort items by sort_order
        if (data.items) {
            (data.items as any[]).sort((a, b) => a.sort_order - b.sort_order);
        }

        return successResponse(data);
    } catch (err) {
        console.error('[order-categories/:id GET]', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PATCH /api/order-categories/[id]
 * Access: Owner, Manager
 */
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

        // Prevent managers from renaming to Liquor
        if (
            body.category_name?.toLowerCase().includes('liquor') &&
            authUser.role !== 'owner'
        ) {
            return errorResponse('Only the owner can assign Liquor to a category name', 403);
        }

        const { data, error } = await supabase
            .from('OrderCategory')
            .update({
                category_name:           body.category_name,
                default_supplier_id:     body.default_supplier_id,
                default_ordering_method: body.default_ordering_method,
                order_days:              body.order_days,
                cutoff_time:             body.cutoff_time,
                responsible_role:        body.responsible_role,
                is_active:               body.is_active,
                sort_order:              body.sort_order,
            })
            .eq('category_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!data)  return errorResponse('Category not found', 404);

        return successResponse(data, 'Category updated successfully');
    } catch (err) {
        console.error('[order-categories/:id PATCH]', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/order-categories/[id]
 * Soft delete — sets is_active = false.
 * Access: Owner only (to prevent accidental category removal by managers)
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized — only owner can delete categories', 403);

        const { id } = await params;
        const supabase = await createClient();

        // 1. Delete dependent DailyOrderTask records
        await supabase
            .from('DailyOrderTask')
            .delete()
            .eq('category_id', id)
            .eq('business_id', authUser.business_id);

        // 2. Delete dependent OrderGuideItem records
        await supabase
            .from('OrderGuideItem')
            .delete()
            .eq('category_id', id)
            .eq('business_id', authUser.business_id);

        // 3. Delete the category itself
        const { data, error } = await supabase
            .from('OrderCategory')
            .delete()
            .eq('category_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!data)  return errorResponse('Category not found', 404);

        return successResponse(null, 'Category deleted successfully');
    } catch (err) {
        console.error('[order-categories/:id DELETE]', err);
        return errorResponse('Internal server error', 500);
    }
}
