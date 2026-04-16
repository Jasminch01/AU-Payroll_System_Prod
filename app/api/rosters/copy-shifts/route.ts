import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * POST /api/rosters/copy-shifts
 * 
 * Copies shifts from a source date range [source_from, source_to] 
 * to a target start date [target_start].
 * 
 * Payload: { source_from: string, source_to: string, target_start: string }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['source_from', 'source_to', 'target_start']);
        if (validationError) return errorResponse(validationError, 400);

        const { source_from, source_to, target_start } = body;
        const supabase = await createClient();

        // 1. Get source shifts
        const { data: sourceShifts, error: shiftError } = await supabase
            .from('Shift')
            .select('*')
            .eq('business_id', authUser.business_id)
            .gte('shift_date', source_from)
            .lte('shift_date', source_to);

        if (shiftError) return errorResponse('Failed to fetch source shifts', 500);
        if (!sourceShifts || sourceShifts.length === 0) {
            return errorResponse('No shifts found in the selected period to copy.', 400);
        }

        // 2. Calculate offsets and range
        const dSourceFrom = new Date(source_from + 'T00:00:00Z');
        const dSourceTo = new Date(source_to + 'T00:00:00Z');
        const dTargetStart = new Date(target_start + 'T00:00:00Z');

        const offsetDays = Math.round((dTargetStart.getTime() - dSourceFrom.getTime()) / (1000 * 60 * 60 * 24));
        const durationDays = Math.round((dSourceTo.getTime() - dSourceFrom.getTime()) / (1000 * 60 * 60 * 24));

        const dTargetEnd = new Date(dTargetStart.getTime());
        dTargetEnd.setUTCDate(dTargetEnd.getUTCDate() + durationDays);
        const target_end = dTargetEnd.toISOString().split('T')[0];

        // 3. Find or Create Target Roster
        // We look for an existing roster that matches the target range exactly first
        let { data: targetRoster, error: rosterFindError } = await supabase
            .from('Roster')
            .select('*')
            .eq('business_id', authUser.business_id)
            .eq('start_date', target_start)
            .eq('end_date', target_end)
            .single();

        if (rosterFindError || !targetRoster) {
            // Create a new draft roster for this range
            const { data: newRoster, error: newRosterError } = await supabase
                .from('Roster')
                .insert({
                    business_id: authUser.business_id,
                    start_date: target_start,
                    end_date: target_end,
                    status: 'draft',
                    created_by: authUser.user_id,
                })
                .select()
                .single();

            if (newRosterError) return errorResponse('Failed to create target roster', 500);
            targetRoster = newRoster;
        }

        // 4. Duplicate Shifts Logic
        // Fetch all existing shifts in the target range to check for overlaps
        const { data: existingShifts, error: existingError } = await supabase
            .from('Shift')
            .select('*, Employee(first_name, last_name)')
            .eq('business_id', authUser.business_id)
            .gte('shift_date', target_start)
            .lte('shift_date', target_end);

        if (existingError) return errorResponse('Failed to check existing shifts', 500);

        const successes: any[] = [];
        const overlaps: string[] = [];

        for (const s of sourceShifts) {
            // Extract just the date part in case shift_date includes a timestamp
            const dateOnlyStr = s.shift_date.split('T')[0];
            const oldDate = new Date(dateOnlyStr + 'T00:00:00Z');
            const newDate = new Date(oldDate.getTime());
            newDate.setUTCDate(newDate.getUTCDate() + offsetDays);
            const newDateStr = newDate.toISOString().split('T')[0];

            // Timestamps: stitch original time to new date
            const oldStartTimePart = s.start_time.split('T')[1];
            const oldEndTimePart = s.end_time.split('T')[1];
            
            // If target roster is published, inherit its published status
            const inheritedStatus = targetRoster.status === 'published' ? 'published' : 'draft';
            
            const ns = {
                business_id: authUser.business_id,
                roster_id: targetRoster.roster_id,
                employee_id: s.employee_id,
                shift_date: newDateStr,
                start_time: `${newDateStr}T${oldStartTimePart}`,
                end_time: `${newDateStr}T${oldEndTimePart}`,
                shift_type: s.shift_type,
                shift_status: inheritedStatus,
            };

            // Check for overlap
            const conflict = existingShifts?.find((es: any) => 
                es.employee_id === ns.employee_id && 
                es.shift_date === ns.shift_date &&
                // Time overlap check
                ((ns.start_time >= es.start_time && ns.start_time < es.end_time) ||
                 (ns.end_time > es.start_time && ns.end_time <= es.end_time) ||
                 (ns.start_time <= es.start_time && ns.end_time >= es.end_time))
            );

            if (conflict) {
                const empName = conflict.Employee ? `${conflict.Employee.first_name} ${conflict.Employee.last_name}` : 'Employee';
                const d = new Date(conflict.start_time);
                const dayStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
                const timeStr = `${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} to ${new Date(conflict.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                
                overlaps.push(`Overlap detected! ${empName} already working on ${dayStr} ${timeStr}`);
            } else {
                successes.push(ns);
            }
        }

        const newShiftIds: string[] = [];
        if (successes.length > 0) {
            const { data: insertedShifts, error: insertError } = await supabase
                .from('Shift')
                .insert(successes)
                .select('shift_id');
            
            if (insertError) return errorResponse('Failed to copy shifts', 500);
            if (insertedShifts) {
                newShiftIds.push(...insertedShifts.map(s => s.shift_id));
            }
        }

        return successResponse({
            roster: targetRoster,
            copiedCount: successes.length,
            overlapCount: overlaps.length,
            overlapDetails: overlaps,
            newShiftIds: newShiftIds
        }, `Shifts copied: ${successes.length} successfully, ${overlaps.length} skipped.`);

    } catch (err) {
        console.error('Copy shifts error:', err);
        return errorResponse('Internal server error', 500);
    }
}
