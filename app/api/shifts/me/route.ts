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
 * VISIBILITY REQUIREMENTS:
 * Shifts are only visible to employees when BOTH conditions are met:
 * 1. The Roster has been published (published_at timestamp exists)
 * 2. The individual Shift has been published (shift_status = 'published')
 * 
 * This ensures managers can create draft shifts without employees seeing them,
 * then publish rosters/shifts when they're ready.
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser || !authUser.employee_id) {
            console.error('Auth check failed - no employee_id:', { authUser });
            return errorResponse('Valid employee profile required to view shifts.', 401);
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        // Query shifts assigned to this employee
        // LOGIC: Show shifts from rosters that HAVE a published_at timestamp.
        // HIDE shifts created AFTER the most recent published_at (these are draft additions).
        let query = supabase
            .from('Shift')
            .select(`
                *,
                Roster!inner (
                    roster_id,
                    status,
                    start_date,
                    end_date,
                    published_at
                )
            `)
            .eq('employee_id', authUser.employee_id)
            .eq('business_id', authUser.business_id)
            .not('Roster.published_at', 'is', null) // Must have been published at least once
            .order('shift_date', { ascending: true });

        if (from) query = query.gte('shift_date', from);
        if (to) query = query.lte('shift_date', to);

        const { data: shifts, error } = await query;

        if (error) {
            console.error('Shift query error:', error, { employee_id: authUser.employee_id, business_id: authUser.business_id });
            return errorResponse(error.message, 400);
        }

        console.log('Shifts before filtering:', { 
            count: shifts?.length, 
            employee_id: authUser.employee_id,
            shifts: shifts?.slice(0, 2)
        });

        // Client-side filtering
        const visibleShifts = (shifts || []).filter((s: any) => {
            // Only show shifts that have been explicitly published
            const isPublished = s.shift_status === 'published';
            if (!isPublished) {
                console.log('Filtering out draft shift:', { shift_id: s.shift_id, shift_status: s.shift_status });
            }
            return isPublished;
        });

        console.log('Visible shifts:', { count: visibleShifts.length });
        return successResponse(visibleShifts, `Found ${visibleShifts.length} published shift(s)`);
    } catch (err) {
        console.error('My shifts error:', err);
        return errorResponse('Internal server error', 500);
    }
}
