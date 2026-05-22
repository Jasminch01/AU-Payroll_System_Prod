import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/checklist-review
 * 
 * Aggregate task completion records for review
 * Access: Owner, Manager
 * 
 * Query Params:
 *  ?from=YYYY-MM-DD
 *  ?to=YYYY-MM-DD
 *  ?employee_id=...
 *  ?status=pending|done|not_done|not_applicable
 *  ?shift_type=morning|afternoon|evening|...
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const employeeId = searchParams.get('employee_id');
        const status = searchParams.get('status');
        const shiftType = searchParams.get('shift_type');

        const supabase = await createClient();

        let query = supabase
            .from('ShiftChecklistItem')
            .select(`
                *,
                Shift!inner(
                    shift_date,
                    shift_type,
                    Employee:employee_id(
                        first_name,
                        last_name,
                        employee_id
                    )
                )
            `)
            .eq('business_id', authUser.business_id);

        if (from) query = query.gte('Shift.shift_date', from);
        if (to) query = query.lte('Shift.shift_date', to);
        if (employeeId) query = query.eq('Shift.employee_id', employeeId);
        if (status) query = query.eq('status', status);
        if (shiftType) query = query.eq('Shift.shift_type', shiftType);

        query = query.order('created_at', { ascending: false });

        const { data: records, error } = await query;

        if (error) return errorResponse(error.message, 400);

        return successResponse(records, `Found ${records.length} record(s)`);
    } catch (err) {
        console.error('Checklist review error:', err);
        return errorResponse('Internal server error', 500);
    }
}
