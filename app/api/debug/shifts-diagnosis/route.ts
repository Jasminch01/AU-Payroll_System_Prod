import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/debug/shifts-diagnosis
 * 
 * Diagnostic endpoint to debug why shifts are not showing
 * This will return detailed information about the authenticated user and their shifts
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) {
            return Response.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const supabase = await createClient();

        // 1. Get auth user details
        const diagnosis: any = {
            authUser: {
                user_id: authUser.user_id,
                email: authUser.email,
                role: authUser.role,
                employee_id: authUser.employee_id,
                business_id: authUser.business_id,
            },
        };

        // 2. Check if employee record exists
        if (authUser.employee_id) {
            const { data: empRecord } = await supabase
                .from('Employee')
                .select('*')
                .eq('employee_id', authUser.employee_id)
                .single();

            diagnosis.employeeRecord = empRecord;
        }

        // 3. Get all shifts for this employee (no filters)
        const { data: allShifts, error: shiftsError } = await supabase
            .from('Shift')
            .select('*')
            .eq('employee_id', authUser.employee_id)
            .eq('business_id', authUser.business_id);

        diagnosis.allShifts = {
            count: allShifts?.length || 0,
            error: shiftsError?.message,
            sample: allShifts?.slice(0, 2),
        };

        // 4. Get shifts with roster info
        const { data: shiftsWithRoster, error: rosterError } = await supabase
            .from('Shift')
            .select(`
                shift_id,
                shift_date,
                start_time,
                end_time,
                shift_status,
                Roster (
                    roster_id,
                    status,
                    published_at,
                    start_date,
                    end_date
                )
            `)
            .eq('employee_id', authUser.employee_id)
            .eq('business_id', authUser.business_id);

        diagnosis.shiftsWithRoster = {
            count: shiftsWithRoster?.length || 0,
            error: rosterError?.message,
            shifts: shiftsWithRoster?.slice(0, 3),
        };

        // 5. Get rosters for the business
        const { data: allRosters } = await supabase
            .from('Roster')
            .select('*')
            .eq('business_id', authUser.business_id)
            .limit(5);

        diagnosis.rosters = {
            count: allRosters?.length || 0,
            sample: allRosters?.slice(0, 2),
        };

        // 6. Run the exact query from /api/shifts/me
        const { data: visibleShifts, error: queryError } = await supabase
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
            .not('Roster.published_at', 'is', null)
            .order('shift_date', { ascending: true });

        diagnosis.visibleShiftsQuery = {
            count: visibleShifts?.length || 0,
            error: queryError?.message,
            shifts: visibleShifts,
        };

        // 7. Check client-side filtering
        const filteredShifts = (visibleShifts || []).filter((s: any) => s.shift_status === 'published');
        diagnosis.afterClientFilter = {
            count: filteredShifts.length,
            shifts: filteredShifts,
        };

        return Response.json(diagnosis);
    } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
