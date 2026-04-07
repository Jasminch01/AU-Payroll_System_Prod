import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/timesheets
 * 
 * List timesheets for the business
 * Access: Owner, Manager (all timesheets), Employee (own only)
 * 
 * Query Params:
 *   ?status=pending|approved|rejected
 *   ?employee_id=uuid (Owner/Manager only)
 *   ?from=YYYY-MM-DD
 *   ?to=YYYY-MM-DD
 */

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        // Employees must have an employee_id linked to their account
        if (authUser.role === 'employee' && !authUser.employee_id) {
            return errorResponse('Valid employee profile required to view timesheets.', 401);
        }

        const { searchParams } = new URL(request.url);
        const employee_id = searchParams.get('employee_id');
        const status = searchParams.get('status');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const supabase = await createClient();

        let query = supabase
            .from('TimeSheet')
            .select(`
                *,
                Employee:employee_id(first_name, last_name, role_title)
            `)
            .eq('business_id', authUser.business_id)
            .order('date', { ascending: false });

        // Employees can only see their own timesheets
        if (authUser.role === 'employee') {
            query = query.eq('employee_id', authUser.employee_id!);
        } else if (employee_id) {
            // Owner/Manager can filter by any employee
            query = query.eq('employee_id', employee_id);
        }

        if (status) query = query.eq('status', status);
        if (from) query = query.gte('date', from);
        if (to) query = query.lte('date', to);

        const { data: timesheets, error } = await query;

        if (error) return errorResponse(error.message, 400);

        // Security: Remove sensitive data if requester is a manager (and not viewing their own profile)
        const redactedTimesheets = timesheets?.map(ts => {
            if (authUser.role === 'manager' && ts.employee_id !== authUser.employee_id) {
                return { ...ts, hourly_rate: null, gross_pay: null, rate_type: null };
            }
            return ts;
        });

        return successResponse(redactedTimesheets);
    } catch (err) {
        console.error('List timesheets error:', err);
        return errorResponse('Internal server error', 500);
    }
}
