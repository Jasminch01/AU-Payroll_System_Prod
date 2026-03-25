import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/leave/balances
 * 
 * Get leave balances
 * Access: Owner, Manager, Employee (own)
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employee_id');
        const year = searchParams.get('year') || new Date().getFullYear().toString();

        const supabase = await createClient();

        let query = supabase
            .from('LeaveBalance')
            .select('*, LeaveType(name, is_paid)')
            .eq('business_id', authUser.business_id)
            .eq('year', parseInt(year));

        // Security: Filter by employee
        if (authUser.role === 'owner' || authUser.role === 'manager') {
            if (employeeId) {
                query = query.eq('employee_id', employeeId);
            }
        } else {
            // Regular employee can only see their own
            query = query.eq('employee_id', authUser.employee_id);
        }

        const { data, error } = await query;

        if (error) return errorResponse(error.message);
        return successResponse(data);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
