import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * PATCH /api/leave/balances/[id]
 * 
 * Manually adjust a leave balance
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "accrued_hours": 40.5,
 *   "taken_hours": 10,
 *   "reason": "Adjustment" (optional)
 * }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized or Insufficient Permissions', 403);

        const body = await request.json();
        const { accrued_hours, taken_hours, reason } = body;

        const updates: any = {
            updated_at: new Date().toISOString()
        };

        if (accrued_hours !== undefined) updates.accrued_hours = accrued_hours;
        if (taken_hours !== undefined) updates.taken_hours = taken_hours;

        const supabase = await createClient();
        const { data, error } = await supabase
            .from('LeaveBalance')
            .update(updates)
            .eq('balance_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message);

        // Optional: Log the adjustment to AuditLog if needed

        return successResponse(data, 'Leave balance adjusted successfully');
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
