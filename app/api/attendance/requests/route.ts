import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';
        let employee_id = searchParams.get('employee_id');

        // Security: If not manager/owner, force filter to own employee_id
        const isManager = ['owner', 'manager'].includes(authUser.role);
        if (!isManager) {
            employee_id = authUser.employee_id || 'none';
        }

        const supabase = await createClient();

        let query = supabase
            .from('AttendanceEditRequest')
            .select(`
                *,
                Employee:employee_id(first_name, last_name, role_title),
                AttendanceLog:attendance_log_id(*)
            `)
            .eq('business_id', authUser.business_id);

        if (status !== 'all') {
            query = query.eq('status', status);
        }
        
        if (employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('List edit requests error:', error);
            return errorResponse(error.message, 400);
        }

        return successResponse(data);
    } catch (err) {
        console.error('List attendance requests error:', err);
        return errorResponse('Internal server error', 500);
    }
}
