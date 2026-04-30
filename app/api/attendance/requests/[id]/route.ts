import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * PUT /api/attendance/requests/[id]
 * 
 * Approve or reject an attendance request
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const { action, manager_note } = body; // action: 'approve' | 'reject'

        const supabase = await createClient();

        // 1. Fetch Request
        const { data: attendanceRequest, error: findError } = await supabase
            .from('AttendanceRequest')
            .select('*')
            .eq('request_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !attendanceRequest) return errorResponse('Attendance request not found', 404);

        if (attendanceRequest.status !== 'pending') {
            return errorResponse('This request has already been processed', 400);
        }

        if (action === 'approve') {
            // 2. Create Attendance Logs
            // We insert a CLOCK_IN and CLOCK_OUT event
            
            const logs = [
                {
                    business_id: attendanceRequest.business_id,
                    employee_id: attendanceRequest.employee_id,
                    event_type: 'CLOCK_IN',
                    timestamp: attendanceRequest.clock_in,
                    override_by: authUser.employee_id || null
                },
                {
                    business_id: attendanceRequest.business_id,
                    employee_id: attendanceRequest.employee_id,
                    event_type: 'CLOCK_OUT',
                    timestamp: attendanceRequest.clock_out,
                    override_by: authUser.employee_id || null
                }
            ];

            const { error: logError } = await supabase
                .from('AttendanceLog')
                .insert(logs);

            if (logError) return errorResponse(`Failed to create attendance logs: ${logError.message}`, 400);
        }

        // 3. Update Request Status
        const { error: updateError } = await supabase
            .from('AttendanceRequest')
            .update({
                status: action === 'approve' ? 'approved' : 'rejected',
                manager_id: authUser.user_id,
                manager_note: manager_note || null,
                updated_at: new Date().toISOString()
            })
            .eq('request_id', id);

        if (updateError) return errorResponse(updateError.message, 400);

        // 4. Notify Employee
        try {
            const { data: employee } = await supabase
                .from('Employee')
                .select('user_id')
                .eq('employee_id', attendanceRequest.employee_id)
                .single();

            if (employee?.user_id) {
                await createNotification({
                    business_id: authUser.business_id,
                    user_ids: [employee.user_id],
                    actor_id: authUser.user_id,
                    type: action === 'approve' ? 'ATTENDANCE_APPROVED' : 'ATTENDANCE_REJECTED',
                    title: action === 'approve' ? 'Attendance Request Approved' : 'Attendance Request Rejected',
                    message: action === 'approve'
                        ? `Your manual attendance request for ${attendanceRequest.date} was approved.`
                        : `Your manual attendance request for ${attendanceRequest.date} was rejected. ${manager_note ? `Note: ${manager_note}` : ''}`,
                    entity_id: id,
                    entity_type: 'attendance_request'
                });
            }
        } catch (notifyErr) {
            console.error('Failed to notify employee of attendance decision:', notifyErr);
        }

        return successResponse(null, action === 'approve' ? 'Request approved successfully' : 'Request rejected');
    } catch (err) {
        console.error('Update attendance request error:', err);
        return errorResponse('Internal server error', 500);
    }
}
