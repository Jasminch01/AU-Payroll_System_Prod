import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/order-suppliers/[id]
 * Access: Owner, Manager
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
            .from('OrderSupplier')
            .select('*')
            .eq('supplier_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!data)  return errorResponse('Supplier not found', 404);

        return successResponse(data);
    } catch (err) {
        console.error('[order-suppliers/:id GET]', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PATCH /api/order-suppliers/[id]
 * Update supplier fields.
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

        const { data, error } = await supabase
            .from('OrderSupplier')
            .update({
                supplier_name:     body.supplier_name,
                contact_person:    body.contact_person,
                phone:             body.phone,
                email:             body.email,
                portal_url:        body.portal_url,
                order_cutoff_time: body.order_cutoff_time,
                delivery_days:     body.delivery_days,
                ordering_method:   body.ordering_method,
                notes:             body.notes,
                is_active:         body.is_active,
            })
            .eq('supplier_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!data)  return errorResponse('Supplier not found', 404);

        return successResponse(data, 'Supplier updated successfully');
    } catch (err) {
        console.error('[order-suppliers/:id PATCH]', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/order-suppliers/[id]
 * Soft delete — sets is_active = false.
 * Access: Owner, Manager
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

        const { data, error } = await supabase
            .from('OrderSupplier')
            .update({ is_active: false })
            .eq('supplier_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!data)  return errorResponse('Supplier not found', 404);

        return successResponse(null, 'Supplier deactivated successfully');
    } catch (err) {
        console.error('[order-suppliers/:id DELETE]', err);
        return errorResponse('Internal server error', 500);
    }
}
