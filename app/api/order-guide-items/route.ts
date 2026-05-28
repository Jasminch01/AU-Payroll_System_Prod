import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * GET /api/order-guide-items
 * List products. Filterable by category_id, is_active, order_day.
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get('category_id');
        const isActive   = searchParams.get('is_active');
        const orderDay   = searchParams.get('order_day'); // e.g. 'Mon'

        const supabase = await createClient();

        let query = supabase
            .from('OrderGuideItem')
            .select(`
                *,
                category:OrderCategory(category_id, category_name),
                supplier:OrderSupplier(supplier_id, supplier_name)
            `)
            .eq('business_id', authUser.business_id)
            .order('sort_order', { ascending: true });

        if (categoryId) query = query.eq('category_id', categoryId);
        if (isActive !== null) query = query.eq('is_active', isActive === 'true');
        if (orderDay)   query = query.contains('order_days', [orderDay]);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);

        return successResponse(data, `Found ${data.length} item(s)`);
    } catch (err) {
        console.error('[order-guide-items GET]', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/order-guide-items
 * Create a new product in the order guide.
 * Access: Owner, Manager
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['category_id', 'product_name', 'unit']);
        if (validationError) return errorResponse(validationError, 400);

        // Validate min <= max
        const min = Number(body.min_stock_qty ?? 0);
        const max = Number(body.max_stock_qty ?? 0);
        if (max < min) {
            return errorResponse('max_stock_qty must be greater than or equal to min_stock_qty', 400);
        }

        const supabase = await createClient();

        // Verify category belongs to this business
        const { data: cat } = await supabase
            .from('OrderCategory')
            .select('category_id')
            .eq('category_id', body.category_id)
            .eq('business_id', authUser.business_id)
            .single();

        if (!cat) return errorResponse('Category not found', 404);

        const { data, error } = await supabase
            .from('OrderGuideItem')
            .insert({
                business_id:          authUser.business_id,
                category_id:          body.category_id,
                supplier_id:          body.supplier_id          ?? null,
                product_name:         body.product_name,
                min_stock_qty:        min,
                max_stock_qty:        max,
                default_order_qty:    body.default_order_qty    ?? null,
                unit:                 body.unit,
                order_frequency:      body.order_frequency      ?? 'daily',
                order_days:           body.order_days           ?? null,
                ordering_method:      body.ordering_method      ?? null,
                ordering_instruction: body.ordering_instruction ?? null,
                comment:              body.comment              ?? null,
                is_active:            body.is_active !== false,
                sort_order:           body.sort_order           ?? 0,
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        return successResponse(data, 'Product added to order guide', 201);
    } catch (err) {
        console.error('[order-guide-items POST]', err);
        return errorResponse('Internal server error', 500);
    }
}
