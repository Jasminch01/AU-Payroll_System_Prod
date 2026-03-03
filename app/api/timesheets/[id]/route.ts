import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * PUT /api/timesheets/[id]
 * 
 * Approve, reject, or manually adjust a timesheet
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "status": "approved" | "rejected" | "pending",
 *   "actual_hours": number,
 *   "gross_pay": number,
 *   "notes": "string",
 *   "flags": "string"
 * }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();

        const supabase = await createClient();

        // 1. Fetch current record to check for 'locked' status
        // Note: In our types, 'locked' isn't on the enum yet, but used in the logic reqs.
        // We will assume 'approved' is the final state for this phase, or check a separate flag.
        const { data: current, error: findError } = await supabase
            .from('TimeSheet')
            .select('*')
            .eq('timesheet_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !current) return errorResponse('Timesheet not found', 404);

        // TODO: If attached to an approved Payroll, prevent edits (Locked state)

        // 2. Prepare updates
        const updates: any = {
            ...body,
            updated_at: new Date().toISOString()
        };

        if (body.status === 'approved') {
            updates.approved_by = authUser.user_id;
            updates.approved_at = new Date().toISOString();
        }

        const { data: updated, error: updateError } = await supabase
            .from('TimeSheet')
            .update(updates)
            .eq('timesheet_id', id)
            .select()
            .single();

        if (updateError) return errorResponse(updateError.message, 400);

        return successResponse(updated, 'Timesheet updated successfully');

    } catch (err) {
        console.error('Update timesheet error:', err);
        return errorResponse('Internal server error', 500);
    }
}
