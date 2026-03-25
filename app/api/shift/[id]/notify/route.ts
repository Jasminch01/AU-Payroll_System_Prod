import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { notifyShiftPublished } from '@/lib/notifications';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/shift/[id]/notify
 * 
 * Publish a single shift and notify the assigned employee.
 * Access: Owner, Manager
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        // 1. Get the shift
        const { data: shift, error: findError } = await supabase
            .from('Shift')
            .select('*')
            .eq('shift_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !shift) return errorResponse('Shift not found', 404);

        // 2. Mark shift as published
        const { data: updated, error: updateError } = await supabase
            .from('Shift')
            .update({
                shift_status: 'published',
                updated_at: new Date().toISOString(),
            })
            .eq('shift_id', id)
            .select()
            .single();

        if (updateError) return errorResponse(updateError.message, 400);

        // 3. Send email notification to the employee (non-blocking)
        if (shift.employee_id) {
            notifyShiftPublished(id).catch(err => 
                console.error(`[Notify] shift publish email failed for ${id}:`, err)
            );
        }

        return successResponse(updated, 'Shift published and employee notified');
    } catch (err) {
        console.error('Notify shift error:', err);
        return errorResponse('Internal server error', 500);
    }
}
