import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { syncTemplateItemInsert, syncTemplateItemsBulk } from '@/lib/checklist-engine';

/**
 * GET /api/checklist-templates/[id]/items
 * 
 * List all items for a template
 * Access: Owner, Manager
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { data: items, error } = await supabase
            .from('ChecklistTemplateItem')
            .select('*')
            .eq('template_id', id)
            .order('sort_order', { ascending: true });

        if (error) return errorResponse(error.message, 400);

        return successResponse(items, `Found ${items.length} item(s)`);
    } catch (err) {
        console.error('List template items error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/checklist-templates/[id]/items
 * 
 * Add a new item to a template
 * Access: Owner, Manager
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const validationError = validateRequiredFields(body, ['task_text']);
        if (validationError) return errorResponse(validationError, 400);

        const supabase = await createClient();

        // Get current max sort_order
        const { data: lastItem } = await supabase
            .from('ChecklistTemplateItem')
            .select('sort_order')
            .eq('template_id', id)
            .order('sort_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        const newSortOrder = (lastItem?.sort_order ?? -1) + 1;

        const { data: item, error } = await supabase
            .from('ChecklistTemplateItem')
            .insert({
                template_id: id,
                business_id: authUser.business_id,
                task_text: body.task_text,
                instructions: body.instructions || null,
                is_required: body.is_required === true,
                is_active: body.is_active !== false,
                sort_order: body.sort_order ?? newSortOrder
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        // Sync to active/modifiable shifts
        await syncTemplateItemInsert(item.item_id, authUser.business_id, supabase, item);

        return successResponse(item, 'Item added successfully', 201);
    } catch (err) {
        console.error('Add template item error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PUT /api/checklist-templates/[id]/items
 * 
 * Bulk update/reorder items
 * Access: Owner, Manager
 * 
 * Body: { items: [{ item_id, sort_order, ... }] }
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const { items } = body;

        if (!items || !Array.isArray(items)) {
            return errorResponse('Items array is required', 400);
        }

        const supabase = await createClient();

        // Perform bulk update (Supabase doesn't have a true bulk update with different values per row in a single query easily, 
        // but we can use upsert if the PKs are provided)
        const { data: updatedItems, error } = await supabase
            .from('ChecklistTemplateItem')
            .upsert(
                items.map(item => ({
                    ...item,
                    template_id: id,
                    business_id: authUser.business_id
                }))
            )
            .select();

        if (error) return errorResponse(error.message, 400);

        // Sync to active/modifiable shifts
        if (updatedItems && updatedItems.length > 0) {
            await syncTemplateItemsBulk(updatedItems, authUser.business_id, supabase);
        }

        return successResponse(updatedItems, `Updated ${updatedItems.length} items`);
    } catch (err) {
        console.error('Bulk update items error:', err);
        return errorResponse('Internal server error', 500);
    }
}
