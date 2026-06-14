import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { AttendanceEditRequestInsert } from '@/types/database';
import { createNotification } from '@/lib/notifications';

/**
 * POST /api/attendance/request-edit
 * 
 * Submit an attendance edit request
 * Access: Employee, Manager, Owner (acting as employee)
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);
        
        if (!authUser.employee_id) {
            return errorResponse('Valid employee profile required to request edits.', 401);
        }

        const body = await request.json();
        const { 
            attendance_log_id, 
            requested_actual_start, 
            requested_actual_end, 
            requested_break_hours, 
            reason 
        } = body;

        // Validation
        if (!requested_actual_start && !requested_actual_end && requested_break_hours === undefined) {
            return errorResponse('At least one change must be requested.', 400);
        }

        if (!reason) {
            return errorResponse('A reason for the edit request is required.', 400);
        }

        const supabase = await createClient();

        const insertData: AttendanceEditRequestInsert = {
            business_id: authUser.business_id,
            employee_id: authUser.employee_id,
            attendance_log_id: attendance_log_id || null,
            requested_actual_start: requested_actual_start || null,
            requested_actual_end: requested_actual_end || null,
            requested_break_hours: requested_break_hours !== undefined ? Number(requested_break_hours) : null,
            reason: reason,
            status: 'pending',
            reviewed_by: null,
            reviewed_at: null,
            manager_note: null
        };

        const { data, error } = await supabase
            .from('AttendanceEditRequest')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Insert edit request error:', error);
            return errorResponse(error.message, 400);
        }

        // Notify Managers of new request
        try {
            const { data: managers } = await supabase
                .from('User')
                .select('user_id')
                .eq('business_id', authUser.business_id)
                .in('role', ['manager', 'owner']);
            
            const managerIds = (managers || []).map(m => m.user_id);
            if (managerIds.length > 0) {
                await createNotification({
                    business_id: authUser.business_id,
                    user_ids: managerIds,
                    actor_id: authUser.user_id,
                    type: 'ATTENDANCE_REQUESTED',
                    title: 'Attendance Correction Request',
                    message: `${authUser.first_name || 'An employee'} requested an attendance correction.`,
                    entity_id: data.request_id,
                    entity_type: 'attendance_edit_request'
                });
            }
        } catch (notifyErr) {
            console.error('Failed to notify managers of attendance request:', notifyErr);
        }

        return successResponse(data, 'Attendance edit request submitted successfully', 201);
    } catch (err) {
        console.error('Attendance edit request error:', err);
        return errorResponse('Internal server error', 500);
    }
}
