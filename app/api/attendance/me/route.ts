import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/attendance/me
 * 
 * Get today's logs for the authenticated employee
 * Access: Employee, Manager (as employee)
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser || !authUser.employee_id) {
            return errorResponse('Valid employee profile required.', 401);
        }

        const supabase = await createClient();

        // Get today's date in local ISO format (start of day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: logs, error } = await supabase
            .from('AttendanceLog')
            .select('*')
            .eq('employee_id', authUser.employee_id)
            .eq('business_id', authUser.business_id)
            .gte('timestamp', today.toISOString())
            .order('timestamp', { ascending: false });

        if (error) return errorResponse(error.message, 400);

        // Also get the most recent log to determine current status
        const currentStatus = logs.length > 0 ? logs[0].event_type : null;

        return successResponse({
            logs,
            current_status: currentStatus,
        });
    } catch (err) {
        console.error('My attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}
