import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

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

        const { error: deleteError } = await supabase
            .from('Shift')
            .delete()
            .eq('business_id', authUser.business_id)
            .in('shift_id', ids);

        if (deleteError) return errorResponse('Failed to delete shifts', 500);

        return successResponse({}, `${ids.length} shifts deleted successfully`);

    } catch (err) {
        console.error('Batch delete shifts error:', err);
        return errorResponse('Internal server error', 500);
    }
}
