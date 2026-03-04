import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/analytics/summary
 * 
 * Get dashboard summary stats
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();
        const today = new Date().toISOString().split('T')[0];

        // 1. Employee Count
        const { count: employeeCount } = await supabase
            .from('Employee')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', authUser.business_id)
            .eq('status', 'active');

        // 2. Pending Timesheets
        const { count: pendingTimesheets } = await supabase
            .from('TimeSheet')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', authUser.business_id)
            .eq('status', 'pending');

        // 3. Pending Leave Requests
        const { count: pendingLeave } = await supabase
            .from('LeaveRequest')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', authUser.business_id)
            .eq('status', 'pending');

        // 4. Shifts Today
        const { count: shiftsToday } = await supabase
            .from('Shift')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', authUser.business_id)
            .eq('shift_date', today);

        // 5. Total Labour Cost Today (Estimated from Timesheets)
        const { data: timesheetsToday } = await supabase
            .from('TimeSheet')
            .select('gross_pay')
            .eq('business_id', authUser.business_id)
            .eq('date', today);

        const labourCostToday = timesheetsToday?.reduce((sum, t) => sum + Number(t.gross_pay), 0) ?? 0;

        return successResponse({
            stats: {
                active_employees: employeeCount ?? 0,
                pending_timesheets: pendingTimesheets ?? 0,
                pending_leave: pendingLeave ?? 0,
                shifts_today: shiftsToday ?? 0,
                labour_cost_today: Number(labourCostToday.toFixed(2)),
            },
            role: authUser.role
        });
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
