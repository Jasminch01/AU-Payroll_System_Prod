import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

/**
 * PUT /api/attendance/requests/[id]
 * 
 * Approve or Reject an attendance edit request
 * Access: Owner, Manager
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const { status, manager_note } = body; // 'approved' or 'rejected'

        if (!['approved', 'rejected'].includes(status)) {
            return errorResponse('Invalid status. Must be approved or rejected.', 400);
        }

        const supabase = await createClient();

        // 1. Fetch the request
        const { data: editReq, error: fetchErr } = await supabase
            .from('AttendanceEditRequest')
            .select('*')
            .eq('request_id', id)
            .single();

        if (fetchErr || !editReq) return errorResponse('Edit request not found.', 404);

        if (editReq.status !== 'pending') {
            return errorResponse('This request has already been processed.', 400);
        }

        // 2. Apply changes if approved
        if (status === 'approved') {
            // Handle Start Time Change (CLOCK_IN)
            if (editReq.requested_actual_start) {
                // If it's an edit of an existing log
                if (editReq.attendance_log_id) {
                    const { error: updateInErr } = await supabase
                        .from('AttendanceLog')
                        .update({
                            timestamp: editReq.requested_actual_start,
                            override_by: authUser.employee_id,
                            override_reason: `Approved Edit Request: ${editReq.reason}`,
                            updated_at: new Date().toISOString()
                        })
                        .eq('log_id', editReq.attendance_log_id);
                    
                    if (updateInErr) console.error('Failed to update start log:', updateInErr);
                } else {
                    // This case might be rare (requesting a start time without a log_id)
                    // But if needed, we could insert a new CLOCK_IN here.
                }
            }

            // Handle End Time Change (CLOCK_OUT)
            if (editReq.requested_actual_end) {
                // Check if a CLOCK_OUT already exists for this session
                // Usually, if they missed it, they won't have a log_id for it.
                
                // If it's an edit of an existing log (e.g. they clocked out at wrong time)
                // We'd need to know WHICH log is the clock out. 
                // In our current simple model, let's look for the CLOCK_OUT log 
                // that follows the CLOCK_IN log (if any).
                
                // For simplicity, let's assume if they provide requested_actual_end, 
                // and there's no log_id or the log_id is for a CLOCK_IN, 
                // we should check if a CLOCK_OUT exists.
                
                const { data: existingOut } = await supabase
                    .from('AttendanceLog')
                    .select('log_id')
                    .eq('employee_id', editReq.employee_id)
                    .eq('event_type', 'CLOCK_OUT')
                    .gte('timestamp', editReq.requested_actual_start || editReq.created_at.split('T')[0])
                    .order('timestamp', { ascending: true })
                    .limit(1)
                    .maybeSingle();

                if (existingOut) {
                    await supabase
                        .from('AttendanceLog')
                        .update({
                            timestamp: editReq.requested_actual_end,
                            override_by: authUser.employee_id,
                            override_reason: `Approved Edit Request: ${editReq.reason}`,
                            updated_at: new Date().toISOString()
                        })
                        .eq('log_id', existingOut.log_id);
                } else {
                    // Insert new CLOCK_OUT
                    await supabase
                        .from('AttendanceLog')
                        .insert({
                            business_id: editReq.business_id,
                            employee_id: editReq.employee_id,
                            event_type: 'CLOCK_OUT',
                            timestamp: editReq.requested_actual_end,
                            override_by: authUser.employee_id,
                            override_reason: `Approved Edit Request (Missing Clock Out): ${editReq.reason}`,
                            device_info: 'Manager Approved Edit'
                        });
                }
            }
        }

        // 3. Update the request status
        const { error: finalError } = await supabase
            .from('AttendanceEditRequest')
            .update({
                status,
                manager_note,
                reviewed_by: authUser.user_id,
                reviewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('request_id', id);

        if (finalError) return errorResponse(finalError.message, 400);

        // 4. Notify Employee
        try {
            const { data: employeeData } = await supabase
                .from('Employee')
                .select('user_id')
                .eq('employee_id', editReq.employee_id)
                .single();

            if (employeeData?.user_id) {
                await createNotification({
                    business_id: authUser.business_id,
                    user_ids: [employeeData.user_id],
                    actor_id: authUser.user_id,
                    type: 'ATTENDANCE_REQUESTED',
                    title: `Attendance Edit ${status === 'approved' ? 'Approved' : 'Rejected'}`,
                    message: `Your attendance edit request for ${new Date(editReq.requested_actual_start || editReq.created_at).toLocaleDateString()} was ${status}.`,
                    entity_id: id,
                    entity_type: 'attendance_edit_request'
                });
            }
        } catch (notifyErr) {
            console.error('Failed to notify employee of request status:', notifyErr);
        }

        return successResponse(null, `Request ${status === 'approved' ? 'approved and applied' : 'rejected'} successfully.`);
    } catch (err) {
        console.error('Process edit request error:', err);
        return errorResponse('Internal server error', 500);
    }
}
