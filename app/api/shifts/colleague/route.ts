import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { getAuthUser, getBusinessTimezone } from '@/lib/auth';
import { getDateInTimezone } from '@/lib/timezone-utils';

/**
 * GET /api/shifts/colleague
 *
 * Fetch published upcoming shifts for a specific colleague within the same business.
 * Used by the swap dialog to let employees see who they can swap with.
 * Access: Employee, Manager, Owner
 *
 * Query params:
 *   - employee_id: the colleague's employee_id
 *   - from: ISO date string (defaults to today)
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const employee_id = searchParams.get('employee_id');
        let from = searchParams.get('from');
        
        if (!from) {
            const timezone = await getBusinessTimezone(authUser.business_id);
            from = getDateInTimezone(new Date().toISOString(), timezone);
        }

        if (!employee_id) {
            return errorResponse('employee_id is required', 400);
        }

        const supabase = await createClient();

        // Security: verify the colleague belongs to the same business
        const { data: colleague } = await supabase
            .from('Employee')
            .select('employee_id')
            .eq('employee_id', employee_id)
            .eq('business_id', authUser.business_id)
            .single();

        if (!colleague) {
            return errorResponse('Colleague not found in your business.', 404);
        }

        // Fetch published upcoming shifts for the colleague
        const { data: shifts, error } = await supabase
            .from('Shift')
            .select(`
                shift_id,
                shift_date,
                start_time,
                end_time,
                shift_type,
                shift_status,
                Roster(roster_id, status, published_at)
            `)
            .eq('employee_id', employee_id)
            .eq('business_id', authUser.business_id)
            .eq('shift_status', 'published')
            .gte('shift_date', from)
            .order('shift_date', { ascending: true });

        if (error) {
            console.error('Colleague shifts error:', error);
            return errorResponse(error.message, 400);
        }

        return successResponse(shifts ?? [], `Found ${(shifts ?? []).length} shift(s)`);
    } catch (err) {
        console.error('Colleague shifts error:', err);
        return errorResponse('Internal server error', 500);
    }
}
