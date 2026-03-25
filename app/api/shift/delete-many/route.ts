import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { notifyShiftDeleted } from '@/lib/notifications';

/**
 * POST /api/shift/delete-many
 * 
 * Batch deletes shifts by their IDs.
 * Used for the "Undo Copy" feature.
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['ids']);
        if (validationError) return errorResponse(validationError, 400);

        const { ids } = body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return successResponse({}, 'No IDs provided, nothing to delete');
        }

        const supabase = await createClient();

        // 1. Fetch published shifts before deletion to notify employees
        const { data: publishedShifts } = await supabase
            .from('Shift')
            .select('*, Employee:employee_id(email, first_name, user_id, business_id)')
            .in('shift_id', ids)
            .eq('business_id', authUser.business_id)
            .eq('shift_status', 'published');

        // 2. Perform deletion
        const { error: deleteError } = await supabase
            .from('Shift')
            .delete()
            .eq('business_id', authUser.business_id)
            .in('shift_id', ids);

        if (deleteError) return errorResponse('Failed to delete shifts', 500);

        // 3. Notify employees of removed shifts (non-blocking)
        if (publishedShifts && publishedShifts.length > 0) {
            for (const shift of publishedShifts) {
                if (shift.Employee) {
                    const shiftTime = `${shift.start_time.split('T')[1]?.substring(0, 5)} - ${shift.end_time.split('T')[1]?.substring(0, 5)}`;
                    notifyShiftDeleted(shift.Employee.email, shift.Employee.first_name, shift.shift_date, shiftTime, shift.Employee.business_id, shift.Employee.user_id).catch((err: Error) => 
                        console.error(`[Notify] Batch shift delete notification failed for ${shift.shift_id}:`, err)
                    );
                }
            }
        }

        return successResponse({}, `${ids.length} shifts deleted successfully`);

    } catch (err) {
        console.error('Batch delete shifts error:', err);
        return errorResponse('Internal server error', 500);
    }
}
