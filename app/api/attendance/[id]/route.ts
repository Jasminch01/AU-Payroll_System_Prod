import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * PATCH /api/attendance/[id]
 * 
 * Update an existing attendance log (Manual Override)
 * Access: Owner, Manager
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id: log_id } = await params;
        const body = await request.json();
        const { timestamp, event_type, override_reason } = body;

        const supabase = await createClient();

        // 1. Verify existence and business_id
        const { data: existingLog, error: fetchError } = await supabase
            .from('AttendanceLog')
            .select('business_id, employee_id, timestamp')
            .eq('log_id', log_id)
            .single();

        if (fetchError || !existingLog) {
            return errorResponse('Attendance record not found', 404);
        }

        if (existingLog.business_id !== authUser.business_id) {
            return errorResponse('Unauthorized access to this record', 403);
        }

        // 2. Prepare update data
        const updateData: any = {
            updated_at: new Date().toISOString(),
        };


        if (timestamp) {
            updateData.timestamp = timestamp;

        }
        if (event_type) updateData.event_type = event_type;
        if (override_reason) updateData.override_reason = override_reason;

        // Always track who performed the override
        updateData.override_by = authUser.employee_id || authUser.user_id;
        // 3. Perform update
        const { data: updatedLog, error: updateError } = await supabase
            .from('AttendanceLog')
            .update(updateData)
            .eq('log_id', log_id)
            .select()
            .single();

        if (updateError) {
            console.error('Failed to update attendance:', {
                error: updateError.message,
                code: updateError.code,
                log_id,
                updateData
            });
            return errorResponse(updateError.message, 400);
        }

        // Verify update was applied
        const { data: verification, error: verifyError } = await supabase
            .from('AttendanceLog')
            .select('*')
            .eq('log_id', log_id)
            .single();

        if (verifyError) {
            console.error('Failed to verify updated attendance:', verifyError);
        } else {

        }

        return successResponse(updatedLog, 'Attendance record updated successfully');
    } catch (err) {
        console.error('Update attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/attendance/[id]
 * 
 * Delete an attendance log
 * Access: Owner, Manager
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id: log_id } = await params;
        const supabase = await createClient();

        // 1. Verify existence and business_id
        const { data: existingLog, error: fetchError } = await supabase
            .from('AttendanceLog')
            .select('business_id')
            .eq('log_id', log_id)
            .single();

        if (fetchError || !existingLog) {
            return errorResponse('Attendance record not found', 404);
        }

        if (existingLog.business_id !== authUser.business_id) {
            return errorResponse('Unauthorized access to this record', 403);
        }

        // 2. Perform delete
        const { error: deleteError } = await supabase
            .from('AttendanceLog')
            .delete()
            .eq('log_id', log_id);

        if (deleteError) return errorResponse(deleteError.message, 400);

        return successResponse(null, 'Attendance record deleted successfully');
    } catch (err) {
        console.error('Delete attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}
