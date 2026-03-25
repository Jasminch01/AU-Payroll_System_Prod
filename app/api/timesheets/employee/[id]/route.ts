import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/timesheets/employee/[id]
 * 
 * Get all timesheets for a specific employee
 * Access: Owner, Manager, or the Employee themselves
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) {
            return errorResponse('Unauthorized', 401);
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const status = searchParams.get('status');

        // Security check: Employees can only see their own timesheets
        if (authUser.role === 'employee' && authUser.employee_id !== id) {
            return errorResponse('Forbidden: You can only view your own timesheets', 403);
        }

        const supabase = await createClient();

        let query = supabase
            .from('TimeSheet')
            .select(`
                *,
                Employee:employee_id(first_name, last_name, role_title)
            `)
            .eq('employee_id', id)
            .eq('business_id', authUser.business_id)
            .order('date', { ascending: false });

        if (status) query = query.eq('status', status);
        if (from) query = query.gte('date', from);
        if (to) query = query.lte('date', to);

        const { data: timesheets, error } = await query;

        if (error) {
            return errorResponse(error.message, 400);
        }

        // Security: Remove sensitive data if requester is a manager (and not viewing their own profile)
        const redactedTimesheets = timesheets?.map((ts: any) => {
            if (authUser.role === 'manager' && ts.employee_id !== authUser.employee_id) {
                return { ...ts, hourly_rate: null, gross_pay: null, rate_type: null };
            }
            return ts;
        });

        return successResponse(redactedTimesheets, `Found ${redactedTimesheets?.length || 0} timesheet(s) for employee`);
    } catch (err) {
        console.error('Get employee timesheets error:', err);
        return errorResponse('Internal server error', 500);
    }
}
