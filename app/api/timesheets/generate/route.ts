import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { generateTimesheets } from '@/lib/timesheet-engine';

/**
 * POST /api/timesheets/generate
 * 
 * Manually trigger timesheet generation
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "start_date": "2026-03-01",
 *   "end_date": "2026-03-07",
 *   "employee_id": "uuid" (optional)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['start_date', 'end_date']);
        if (validationError) return errorResponse(validationError, 400);

        const { start_date, end_date, employee_id } = body;

        // 1. Generate the records using the engine
        const timesheets = await generateTimesheets(
            authUser.business_id,
            start_date,
            end_date,
            employee_id
        );

        if (timesheets.length === 0) {
            return successResponse([], 'No logs or rostered shifts found for the selected range.');
        }

        const supabase = await createClient();

        // 2. Upsert the generated timesheets
        // ON CONFLICT (employee_id, date) we DO NOTHING or UPDATE 
        // Logic: if it's already approved, maybe we don't overwrite?
        // For now, only upsert if status is pending.

        const { data, error } = await supabase
            .from('TimeSheet')
            .upsert(timesheets, {
                onConflict: 'employee_id,date',
                ignoreDuplicates: false // We want to update existing ones if they changed
            })
            .select();

        if (error) return errorResponse(error.message, 400);

        return successResponse(
            data,
            `Successfully generated/updated ${data.length} timesheets.`
        );

    } catch (err) {
        console.error('Generate timesheets error:', err);
        return errorResponse('Internal server error', 500);
    }
}
