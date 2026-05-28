import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * GET /api/order-categories
 * List all order categories with their item counts.
 * Liquor Key Items is filtered in the response for managers
 * without can_order_liquor permission.
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
            .from('OrderCategory')
            .select(`
                *,
                supplier:OrderSupplier(supplier_id, supplier_name, ordering_method),
                item_count:OrderGuideItem(count)
            `)
            .eq('business_id', authUser.business_id)
            .order('sort_order', { ascending: true });

        if (isActive !== null) {
            query = query.eq('is_active', isActive === 'true');
        }

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);

        // Format item_count, filter Liquor for non-authorised managers
        let categories = (data ?? []).map(c => ({
            ...c,
            item_count: (c.item_count as any)?.[0]?.count ?? 0,
        }));

        // Liquor access: owner always sees it; manager needs can_order_liquor
        if (authUser.role !== 'owner' && !authUser.can_order_liquor) {
            categories = categories.filter(
                c => !c.category_name.toLowerCase().includes('liquor')
            );
        }

        return successResponse(categories, `Found ${categories.length} category(ies)`);
    } catch (err) {
        console.error('[order-categories GET]', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/order-categories
 * Create a new order category.
 * Only owners can create a Liquor category.
 * Access: Owner, Manager
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['category_name']);
        if (validationError) return errorResponse(validationError, 400);

        // Only owner can create Liquor category
        if (
            body.category_name.toLowerCase().includes('liquor') &&
            authUser.role !== 'owner'
        ) {
            return errorResponse('Only the owner can create a Liquor category', 403);
        }

        const supabase = await createClient();

        const { data, error } = await supabase
            .from('OrderCategory')
            .insert({
                business_id:             authUser.business_id,
                category_name:           body.category_name,
                default_supplier_id:     body.default_supplier_id     ?? null,
                default_ordering_method: body.default_ordering_method ?? null,
                order_days:              body.order_days              ?? null,
                cutoff_time:             body.cutoff_time             ?? null,
                responsible_role:        body.responsible_role        ?? 'manager',
                is_active:               body.is_active !== false,
                sort_order:              body.sort_order              ?? 0,
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        return successResponse(data, 'Category created successfully', 201);
    } catch (err) {
        console.error('[order-categories POST]', err);
        return errorResponse('Internal server error', 500);
    }
}
