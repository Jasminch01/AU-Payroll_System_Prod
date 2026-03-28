import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/payroll/lines
 * 
 * Get payroll lines filtered by employee_id and/or payroll_id
 * Access: Owner, Manager
 * 
 * Query Params:
 *   ?employee_id=uuid (required or optional depending on use)
 *   ?payroll_id=uuid (optional, narrow to a specific payroll)
 *   ?payment_status=pending|paid|failed (optional)
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const employee_id = searchParams.get('employee_id');
        const payroll_id = searchParams.get('payroll_id');
        const payment_status = searchParams.get('payment_status');

        const supabase = await createClient();

        let query = supabase
            .from('PayrollLine')
            .select(`
                *,
                Employee:employee_id(employee_id, first_name, last_name, role_title),
                Payroll:payroll_id(payroll_id, period_start, period_end, status)
            `)
            .order('created_at', { ascending: false });

        // Filter by employee
        if (employee_id) query = query.eq('employee_id', employee_id);

        // Filter by specific payroll
        if (payroll_id) query = query.eq('payroll_id', payroll_id);

        // Filter by payment status
        if (payment_status) query = query.eq('payment_status', payment_status);

        const { data: lines, error } = await query;

        if (error) return errorResponse(error.message, 400);

        return successResponse(lines, `Found ${lines.length} payroll line(s)`);
    } catch (err) {
        console.error('Get payroll lines error:', err);
        return errorResponse('Internal server error', 500);
    }
}
