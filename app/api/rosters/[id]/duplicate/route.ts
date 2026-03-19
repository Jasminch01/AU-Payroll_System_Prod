import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/rosters/[id]/duplicate
 * 
 * Duplicate a roster and all its shifts to a new start date
 * Access: Owner, Manager
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        
        const validationError = validateRequiredFields(body, ['target_start']);
        if (validationError) return errorResponse(validationError, 400);

        const { target_start } = body;
        const supabase = await createClient();

        // 1. Get original roster
        const { data: original, error: findError } = await supabase
            .from('Roster')
            .select('*, Shift(*)')
            .eq('roster_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !original) return errorResponse('Original roster not found', 404);

        // 2. Calculate day-based offset purely from the date strings
        const dOldStart = new Date(original.start_date + 'T00:00:00Z');
        const dNewStart = new Date(target_start + 'T00:00:00Z');
        const dOldEnd = new Date(original.end_date + 'T00:00:00Z');

        const offsetDays = Math.round((dNewStart.getTime() - dOldStart.getTime()) / (1000 * 60 * 60 * 24));
        const durationDays = Math.round((dOldEnd.getTime() - dOldStart.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate the new end date as a string (YYYY-MM-DD + durationDays)
        const dNewEnd = new Date(dNewStart.getTime());
        dNewEnd.setUTCDate(dNewEnd.getUTCDate() + durationDays);

        const newTargetEndStr = dNewEnd.toISOString().split('T')[0];

        // 3. Create the NEW Roster
        const { data: newRoster, error: rosterError } = await supabase
            .from('Roster')
            .insert({
                business_id: authUser.business_id,
                start_date: target_start,
                end_date: newTargetEndStr,
                status: 'draft',
                created_by: authUser.user_id,
            })
            .select()
            .single();

        if (rosterError) return errorResponse('Failed to create new roster', 400);

        // 4. Duplicate Shifts
        if (original.Shift && original.Shift.length > 0) {
            const newShifts = original.Shift.map((s: any) => {
                // Shift Date: Move exactly by 'offsetDays'
                const oldDate = new Date(s.shift_date + 'T00:00:00Z');
                const newDate = new Date(oldDate.getTime());
                newDate.setUTCDate(newDate.getUTCDate() + offsetDays);

                // Start/End Timestamps:
                // We MUST avoid millisecond math for the base time to prevent DST/Timezone skew.
                // Step 1: Get the new date string (YYYY-MM-DD)
                const newDateStr = newDate.toISOString().split('T')[0];
                
                // Step 2: Extract the ORIGINAL time part ('HH:MM:SS.SSS')
                // and stitch it to the NEW date string.
                const oldStartTimePart = s.start_time.split('T')[1];
                const oldEndTimePart = s.end_time.split('T')[1];
                
                const newStartTime = `${newDateStr}T${oldStartTimePart}`;
                const newEndTime = `${newDateStr}T${oldEndTimePart}`;

                return {
                    business_id: authUser.business_id,
                    roster_id: newRoster.roster_id,
                    employee_id: s.employee_id,
                    shift_date: newDateStr,
                    start_time: newStartTime,
                    end_time: newEndTime,
                    shift_type: s.shift_type,
                };
            });

            const { error: shiftError } = await supabase.from('Shift').insert(newShifts);
            if (shiftError) {
                console.error('Error copying shifts during duplication:', shiftError);
                // We don't rollback since we want the new roster to stay even if some shifts fail
                // but let's notify
            }
        }

        return successResponse(newRoster, 'Roster duplicated successfully');
    } catch (err) {
        console.error('Duplicate roster error:', err);
        return errorResponse('Internal server error', 500);
    }
}
