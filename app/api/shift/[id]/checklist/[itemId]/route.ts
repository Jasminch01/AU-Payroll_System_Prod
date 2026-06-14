import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getBusinessTimezone } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { getDateInTimezone, getTimeInTimezone } from '@/lib/timezone-utils';

/**
 * PATCH /api/shift/[id]/checklist/[itemId]
 * 
 * Update a shift checklist item status or metadata
 * Access: Owner, Manager, or the Assigned Employee
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager', 'employee');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id, itemId } = await params;
        const body = await request.json();
        const supabase = await createClient();

        // 1. Fetch current item to check status and requirement
        const { data: currentItem, error: fetchError } = await supabase
            .from('ShiftChecklistItem')
            .select('*')
            .eq('checklist_item_id', itemId)
            .eq('shift_id', id)
            .single();

        if (fetchError || !currentItem) return errorResponse('Item not found', 404);

        // Check shift status and times
        const { data: shift, error: shiftError } = await supabase
            .from('Shift')
            .select('shift_status, start_time, end_time, business_id')
            .eq('shift_id', id)
            .single();

        if (shiftError || !shift) return errorResponse('Shift not found', 404);

        const tz = await getBusinessTimezone(shift.business_id);
        const nowStr = new Date().toISOString();
        const nowBusinessDate = getDateInTimezone(nowStr, tz);
        const nowBusinessTime = getTimeInTimezone(nowStr, tz);
        const nowBusinessTimestamp = `${nowBusinessDate}T${nowBusinessTime}:00`;

        if (shift.shift_status === 'published') {
            if (nowBusinessTimestamp > shift.end_time) {
                return errorResponse('Cannot update checklist tasks after the shift has completed.', 400);
            }

            if (nowBusinessTimestamp >= shift.start_time) {
                // Check if attempting structural edits (only status/reason are allowed after shift starts)
                if (
                    body.task_text !== undefined ||
                    body.instructions !== undefined ||
                    body.is_required !== undefined ||
                    body.sort_order !== undefined
                ) {
                    return errorResponse('Cannot edit task details on a published shift once it has started. Only status updates are allowed.', 400);
                }
            }
        }

        // 2. Authorization & Validation
        const isManager = authUser.role === 'owner' || authUser.role === 'manager';
        const updates: any = { updated_at: new Date().toISOString() };

        if (isManager) {
            // Managers can update everything
            if (body.task_text !== undefined) updates.task_text = body.task_text;
            if (body.instructions !== undefined) updates.instructions = body.instructions;
            if (body.is_required !== undefined) updates.is_required = body.is_required;
            if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
            if (body.status !== undefined) {
                updates.status = body.status;
                if (body.status !== 'pending') {
                    updates.completed_by = authUser.user_id;
                    updates.completed_at = new Date().toISOString();
                } else {
                    updates.completed_by = null;
                    updates.completed_at = null;
                }
            }
            if (body.reason !== undefined) updates.reason = body.reason;
        } else {
            // Employees can only update status and reason
            if (body.status !== undefined) {
                updates.status = body.status;
                updates.completed_by = authUser.user_id;
                updates.completed_at = new Date().toISOString();

                // Validate reason for required tasks marked 'not_done'
                if (currentItem.is_required && body.status === 'not_done' && !body.reason) {
                    return errorResponse('Reason is required when marking a required task as Not Done', 400);
                }
            }
            if (body.reason !== undefined) updates.reason = body.reason;
        }

        const { data: item, error } = await supabase
            .from('ShiftChecklistItem')
            .update(updates)
            .eq('checklist_item_id', itemId)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(item, 'Task updated successfully');
    } catch (err) {
        console.error('Update shift task error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/shift/[id]/checklist/[itemId]
 * 
 * Remove an item from a shift's checklist
 * Access: Owner, Manager
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id, itemId } = await params;
        const supabase = await createClient();

        // Check shift status and times
        const { data: shift, error: shiftError } = await supabase
            .from('Shift')
            .select('shift_status, start_time, end_time, business_id')
            .eq('shift_id', id)
            .single();

        if (shiftError || !shift) return errorResponse('Shift not found', 404);

        const tz = await getBusinessTimezone(shift.business_id);
        const nowStr = new Date().toISOString();
        const nowBusinessDate = getDateInTimezone(nowStr, tz);
        const nowBusinessTime = getTimeInTimezone(nowStr, tz);
        const nowBusinessTimestamp = `${nowBusinessDate}T${nowBusinessTime}:00`;

        if (shift.shift_status === 'published') {
            if (nowBusinessTimestamp > shift.end_time) {
                return errorResponse('Cannot modify checklist after the shift has completed.', 400);
            }

            if (nowBusinessTimestamp >= shift.start_time) {
                return errorResponse('Cannot remove tasks from a published shift once it has started.', 400);
            }
        }

        const { error } = await supabase
            .from('ShiftChecklistItem')
            .delete()
            .eq('checklist_item_id', itemId)
            .eq('shift_id', id);

        if (error) return errorResponse(error.message, 400);

        return successResponse(null, 'Task removed successfully');
    } catch (err) {
        console.error('Remove shift task error:', err);
        return errorResponse('Internal server error', 500);
    }
}
