import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/shifts/me
 * 
 * Get assigned shifts for the authenticated employee
 * Access: Employee, Manager, Owner
 * 
 * Note: Only returns shifts from PUBLISHED rosters.
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser || !authUser.employee_id) {
            return errorResponse('Valid employee profile required to view shifts.', 401);
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        // Query shifts assigned to this employee
        // We join with Roster to filter by status='published'
        let query = supabase
            .from('Shift')
            .select(`
                *,
                Roster!inner (
                    roster_id,
                    status,
                    start_date,
                    end_date
                )
            `)
            .eq('employee_id', authUser.employee_id)
            .eq('business_id', authUser.business_id)
            .eq('Roster.status', 'published') // Only published rosters
            .order('shift_date', { ascending: true });

        if (from) query = query.gte('shift_date', from);
        if (to) query = query.lte('shift_date', to);

        const { data: shifts, error } = await query;

        if (error) return errorResponse(error.message, 400);

        return successResponse(shifts, `Found ${shifts.length} upcoming shift(s)`);
    } catch (err) {
        console.error('My shifts error:', err);
        return errorResponse('Internal server error', 500);
    }
}
