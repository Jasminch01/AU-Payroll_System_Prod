import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * GET /api/order-suppliers
 * List all suppliers for the business.
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('is_active');

        const supabase = await createClient();

        let query = supabase
            .from('OrderSupplier')
            .select('*')
            .eq('business_id', authUser.business_id)
            .order('supplier_name', { ascending: true });

        if (isActive !== null) {
            query = query.eq('is_active', isActive === 'true');
        }

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);

        return successResponse(data, `Found ${data.length} supplier(s)`);
    } catch (err) {
        console.error('[order-suppliers GET]', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/order-suppliers
 * Create a new supplier.
 * Access: Owner, Manager
 *
 * NOTE: No password field accepted. Portal URL only.
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['supplier_name']);
        if (validationError) return errorResponse(validationError, 400);

        const supabase = await createClient();

        const { data, error } = await supabase
            .from('OrderSupplier')
            .insert({
                business_id:       authUser.business_id,
                supplier_name:     body.supplier_name,
                contact_person:    body.contact_person   ?? null,
                phone:             body.phone            ?? null,
                email:             body.email            ?? null,
                portal_url:        body.portal_url       ?? null,
                order_cutoff_time: body.order_cutoff_time ?? null,
                delivery_days:     body.delivery_days    ?? null,
                ordering_method:   body.ordering_method  ?? null,
                notes:             body.notes            ?? null,
                is_active:         body.is_active !== false,
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        return successResponse(data, 'Supplier created successfully', 201);
    } catch (err) {
        console.error('[order-suppliers POST]', err);
        return errorResponse('Internal server error', 500);
    }
}
