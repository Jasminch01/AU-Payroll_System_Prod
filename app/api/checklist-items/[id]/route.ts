import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * PATCH /api/checklist-items/[id]
 * 
 * Update a specific checklist item status or text
 * Access: Owner, Manager, or Assigned Employee (for status only)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager', 'employee');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const { status, task_text, instructions, is_required, sort_order } = await request.json();

        const supabase = await createClient();

        // Fetch current item to check shift ownership
        const { data: item, error: fetchError } = await supabase
            .from('ShiftChecklistItem')
            .select(`
                *,
                Shift!inner(employee_id)
            `)
            .eq('checklist_item_id', id)
            .single();

        if (fetchError || !item) return errorResponse('Item not found', 404);

        // Security: If employee, they can only update STATUS and only for THEIR shifts
        if (authUser.role === 'employee') {
            if (item.Shift.employee_id !== authUser.user_id) {
                return errorResponse('You are not authorized to update this task', 403);
            }
            
            // Employee can only update status
            const updateData: any = { status };
            if (status === 'done') {
                updateData.completed_at = new Date().toISOString();
                updateData.completed_by = authUser.user_id;
            } else if (status === 'pending') {
                updateData.completed_at = null;
                updateData.completed_by = null;
            }

            const { data, error } = await supabase
                .from('ShiftChecklistItem')
                .update(updateData)
                .eq('checklist_item_id', id)
                .select()
                .single();

            if (error) return errorResponse(error.message, 400);
            return successResponse(data, 'Task updated successfully');
        }

        // Managers/Owners can update everything
        const updateData: any = {};
        if (status !== undefined) updateData.status = status;
        if (task_text !== undefined) updateData.task_text = task_text;
        if (instructions !== undefined) updateData.instructions = instructions;
        if (is_required !== undefined) updateData.is_required = is_required;
        if (sort_order !== undefined) updateData.sort_order = sort_order;

        if (status === 'done' && item.status !== 'done') {
            updateData.completed_at = new Date().toISOString();
            updateData.completed_by = authUser.user_id;
        } else if (status === 'pending' && item.status === 'done') {
            updateData.completed_at = null;
            updateData.completed_by = null;
        }

        const { data, error } = await supabase
            .from('ShiftChecklistItem')
            .update(updateData)
            .eq('checklist_item_id', id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        return successResponse(data, 'Task updated successfully');

    } catch (err) {
        console.error('Update checklist item error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/checklist-items/[id]
 * 
 * Delete a checklist item
 * Access: Owner, Manager
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { error } = await supabase
            .from('ShiftChecklistItem')
            .delete()
            .eq('checklist_item_id', id);

        if (error) return errorResponse(error.message, 400);

        return successResponse(null, 'Task deleted successfully');
    } catch (err) {
        console.error('Delete checklist item error:', err);
        return errorResponse('Internal server error', 500);
    }
}
