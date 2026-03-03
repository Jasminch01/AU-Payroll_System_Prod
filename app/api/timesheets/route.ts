import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/timesheets
 * 
 * List timesheets for the business
 * Access: Owner, Manager
 * 
 * Query Params:
 *   ?status=pending|approved|rejected
 *   ?employee_id=uuid
 *   ?from=YYYY-MM-DD
 *   ?to=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

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

        if (employee_id) query = query.eq('employee_id', employee_id);
        if (status) query = query.eq('status', status);
        if (from) query = query.gte('date', from);
        if (to) query = query.lte('date', to);

        const { data: timesheets, error } = await query;

        if (error) return errorResponse(error.message, 400);

        return successResponse(timesheets);
    } catch (err) {
        console.error('List timesheets error:', err);
        return errorResponse('Internal server error', 500);
    }
}
