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

        console.log('Update request received:', {
            log_id,
            body,
            timestamp: body.timestamp,
            event_type: body.event_type,
            override_reason: body.override_reason
        });

        if (timestamp) {
            updateData.timestamp = timestamp;
            console.log('Setting timestamp in update:', {
                log_id,
                employee_id: existingLog.employee_id,
                old_timestamp: existingLog?.timestamp,
                new_timestamp: timestamp,
                event_type,
                updateData_keys: Object.keys(updateData)
            });
        }
        if (event_type) updateData.event_type = event_type;
        if (override_reason) updateData.override_reason = override_reason;

        // Always track who performed the override
        if (authUser.employee_id) {
            updateData.override_by = authUser.employee_id;
        }

        console.log('Final updateData to be sent:', JSON.stringify(updateData, null, 2));

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

        console.log('Attendance record updated successfully:', {
            log_id: updatedLog.log_id,
            employee_id: updatedLog.employee_id,
            event_type: updatedLog.event_type,
            timestamp: updatedLog.timestamp,
            override_by: updatedLog.override_by,
            override_reason: updatedLog.override_reason,
            updated_at: updatedLog.updated_at,
            full_log: JSON.stringify(updatedLog, null, 2)
        });

        // Verify update was applied
        const { data: verification, error: verifyError } = await supabase
            .from('AttendanceLog')
            .select('*')
            .eq('log_id', log_id)
            .single();

        if (verifyError) {
            console.error('Failed to verify updated attendance:', verifyError);
        } else {
            console.log('Verification: Updated attendance record found in database:', {
                log_id: verification.log_id,
                event_type: verification.event_type,
                timestamp: verification.timestamp,
                override_by: verification.override_by
            });
        }

        return successResponse(updatedLog, 'Attendance record updated successfully');
    } catch (err) {
        console.error('Update attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}
