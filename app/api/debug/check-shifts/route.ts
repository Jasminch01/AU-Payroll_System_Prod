import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/debug/check-shifts?employee_id=BEA0015
 *
 * Check shifts for a specific employee in the database
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employee_id');

        if (!employeeId) {
            return Response.json(
                { error: 'employee_id query parameter required' },
                { status: 400 }
            );
        }

        const result: any = {
            employeeId,
            checks: {},
        };

        // 1. Check employee exists
        const { data: employee, error: empError } = await supabase
            .from('Employee')
            .select('*')
            .eq('employee_id', employeeId)
            .single();

        result.checks.employeeExists = {
            found: !!employee,
            error: empError?.message,
            data: employee,
        };

        if (!employee) {
            result.checks.businessId = employee?.business_id;
        } else {
            // 2. Get all shifts for this employee
            const { data: allShifts } = await supabase
                .from('Shift')
                .select('*')
                .eq('employee_id', employeeId);

            result.checks.allShiftsInDB = {
                count: allShifts?.length || 0,
                shifts: allShifts?.slice(0, 3),
            };

            // 3. Get shifts with roster info
            const { data: shiftsWithRoster, error: joinError } = await supabase
                .from('Shift')
                .select(`
                    shift_id,
                    shift_date,
                    shift_status,
                    Roster (
                        roster_id,
                        status,
                        published_at
                    )
                `)
                .eq('employee_id', employeeId);

            result.checks.shiftsWithRoster = {
                count: shiftsWithRoster?.length || 0,
                error: joinError?.message,
                shifts: shiftsWithRoster?.slice(0, 3),
            };

            // 4. Check shift status breakdown
            const draftShifts = allShifts?.filter((s) => s.shift_status === 'draft') || [];
            const publishedShifts =
                allShifts?.filter((s) => s.shift_status === 'published') || [];

            result.checks.statusBreakdown = {
                draft: draftShifts.length,
                published: publishedShifts.length,
                total: allShifts?.length,
            };

            // 5. Check rosters with published_at
            const { data: rostersWithPublished } = await supabase
                .from('Roster')
                .select('roster_id, status, published_at')
                .not('published_at', 'is', null)
                .eq('business_id', employee.business_id)
                .limit(5);

            result.checks.publishedRosters = {
                count: rostersWithPublished?.length || 0,
                rosters: rostersWithPublished?.slice(0, 3),
            };

            // 6. Simulate the exact API query
            const { data: apiQueryResult, error: apiError } = await supabase
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
                .eq('employee_id', employeeId)
                .not('Roster.published_at', 'is', null);

            result.checks.apiQuery = {
                count: apiQueryResult?.length || 0,
                error: apiError?.message,
                shifts: apiQueryResult?.slice(0, 2),
            };

            // 7. Check filtering
            const filtered = (apiQueryResult || []).filter(
                (s) => s.shift_status === 'published'
            );
            result.checks.afterClientFilter = {
                count: filtered.length,
                shifts: filtered.slice(0, 2),
            };
        }

        return Response.json(result);
    } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
