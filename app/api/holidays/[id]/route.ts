import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * DELETE /api/holidays/[id]
 * 
 * Delete a public holiday
 * Access: Owner, Manager
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }  // ✅ wrapped in Promise
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id: holidayId } = await params;  // ✅ awaited params
        const supabase = await createClient();

        const { error } = await supabase
            .from('PublicHoliday')
            .delete()
            .eq('holiday_id', holidayId)
            .eq('business_id', authUser.business_id);
git
        if (error) return errorResponse(error.message);
        return successResponse(null, 'Public holiday deleted');
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}