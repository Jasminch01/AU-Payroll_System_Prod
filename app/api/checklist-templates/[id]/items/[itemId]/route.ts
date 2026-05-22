import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * PUT /api/checklist-templates/[id]/items/[itemId]
 * 
 * Update a single template item
 * Access: Owner, Manager
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { itemId } = await params;
        const body = await request.json();
        const supabase = await createClient();

        const { data: item, error } = await supabase
            .from('ChecklistTemplateItem')
            .update({
                task_text: body.task_text,
                instructions: body.instructions,
                is_required: body.is_required,
                is_active: body.is_active,
                sort_order: body.sort_order
            })
            .eq('item_id', itemId)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!item) return errorResponse('Item not found', 404);

        return successResponse(item, 'Item updated successfully');
    } catch (err) {
        console.error('Update item error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/checklist-templates/[id]/items/[itemId]
 * 
 * Remove an item from a template
 * Access: Owner, Manager
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { itemId } = await params;
        const supabase = await createClient();

        const { error } = await supabase
            .from('ChecklistTemplateItem')
            .delete()
            .eq('item_id', itemId)
            .eq('business_id', authUser.business_id);

        if (error) return errorResponse(error.message, 400);

        return successResponse(null, 'Item deleted successfully');
    } catch (err) {
        console.error('Delete item error:', err);
        return errorResponse('Internal server error', 500);
    }
}
