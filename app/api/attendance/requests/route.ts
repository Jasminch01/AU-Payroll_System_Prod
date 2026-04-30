import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

/**
 * GET /api/attendance/requests
 * 
 * List attendance requests
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const employee_id = searchParams.get('employee_id');

        const supabase = await createClient();
        let query = supabase
            .from('AttendanceRequest')
            .select('*, Employee:employee_id(first_name, last_name, role_title)')
            .eq('business_id', authUser.business_id)
            .order('created_at', { ascending: false });

        if (authUser.role === 'employee') {
            query = query.eq('employee_id', authUser.employee_id);
        } else if (employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);

        return successResponse(data);
    } catch (err) {
        console.error('List attendance requests error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/attendance/requests
 * 
 * Submit a manual attendance request
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser || !authUser.employee_id) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const { date, clock_in, clock_out, break_duration, reason } = body;

        if (!date || !clock_in || !clock_out) {
            return errorResponse('Missing required fields', 400);
        }

        const supabase = await createClient();

        // 1. Insert Request
        const { data: attendanceRequest, error } = await supabase
            .from('AttendanceRequest')
            .insert({
                business_id: authUser.business_id,
                employee_id: authUser.employee_id,
                date,
                clock_in,
                clock_out,
                break_duration: break_duration || 0,
                reason,
                status: 'pending'
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        // 2. Notify Managers
        try {
            const { data: managers } = await supabase
                .from('User')
                .select('user_id')
                .eq('business_id', authUser.business_id)
                .in('role', ['manager', 'owner']);
            
            const managerUserIds = (managers || []).map(m => m.user_id);
            if (managerUserIds.length > 0) {
                await createNotification({
                    business_id: authUser.business_id,
                    user_ids: managerUserIds,
                    actor_id: authUser.user_id,
                    type: 'ATTENDANCE_REQUESTED',
                    title: 'Manual Attendance Request',
                    message: `${authUser.first_name} ${authUser.last_name} submitted a manual attendance entry for ${date}.`,
                    entity_id: attendanceRequest.request_id,
                    entity_type: 'attendance_request'
                });
            }
        } catch (notifyErr) {
            console.error('Failed to notify managers of attendance request:', notifyErr);
        }

        return successResponse(attendanceRequest, 'Attendance request submitted', 201);
    } catch (err) {
        console.error('Create attendance request error:', err);
        return errorResponse('Internal server error', 500);
    }
}
