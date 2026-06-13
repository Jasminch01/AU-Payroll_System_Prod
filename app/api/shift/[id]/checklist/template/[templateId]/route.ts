import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getBusinessTimezone } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { getDateInTimezone, getTimeInTimezone } from '@/lib/timezone-utils';

/**
 * DELETE /api/shift/[id]/checklist/template/[templateId]
 * 
 * Remove all tasks associated with a specific template from a shift
 * Access: Owner, Manager
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; templateId: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id, templateId } = await params;
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

        if (nowBusinessTimestamp > shift.end_time) {
            return errorResponse('Cannot modify checklist after the shift has completed.', 400);
        }

        if (shift.shift_status === 'published' && nowBusinessTimestamp >= shift.start_time) {
            return errorResponse('Cannot remove template tasks from a published shift once it has started.', 400);
        }

        const { error } = await supabase
            .from('ShiftChecklistItem')
            .delete()
            .eq('source_template_id', templateId)
            .eq('shift_id', id);

        if (error) return errorResponse(error.message, 400);

        return successResponse(null, 'Template tasks removed successfully');
    } catch (err) {
        console.error('Remove template tasks error:', err);
        return errorResponse('Internal server error', 500);
    }
}
