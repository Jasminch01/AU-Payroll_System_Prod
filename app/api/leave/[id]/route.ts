import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getAuthUser } from '@/lib/auth';
import {
    successResponse,
    errorResponse
} from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';

/**
 * PUT /api/leave/[id]
 * 
 * Update leave status (Approve/Reject)
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "status": "approved" | "rejected" | "cancelled",
 *   "rejection_reason": "string" (optional),
 *   "manager_note": "string" (optional)
 * }
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const { status, rejection_reason, manager_note } = body;

        if (!['approved', 'rejected', 'pending', 'cancelled'].includes(status)) {
            return errorResponse('Invalid status', 400);
        }

        const supabase = await createClient();

        // 1. Fetch current leave request
        const { data: current, error: fetchError } = await supabase
            .from('LeaveRequest')
            .select('*')
            .eq('request_id', id)
            .single();

        if (fetchError || !current) {
            console.error('LeaveRequest fetch error:', fetchError);
            return errorResponse('Leave request not found', 404);
        }

        const targetEmployeeId = current.employee_id;
        let targetUserRole = 'employee';

        // Fetch target user's role to apply approval rules
        const { data: empData } = await supabase
            .from('Employee')
            .select('user_id')
            .eq('employee_id', targetEmployeeId)
            .single();

        if (empData?.user_id) {
            const { data: userData } = await supabase
                .from('User')
                .select('role')
                .eq('user_id', empData.user_id)
                .single();
            if (userData) {
                targetUserRole = userData.role;
            }
        }

        // 2. Validate approval logic
        // Rule: Managers/Owners cannot approve THEIR OWN leave
        if (authUser.employee_id === targetEmployeeId) {
            return errorResponse('You cannot approve your own leave requests.', 403);
        }

        // Rule: If the target is a manager (or owner), only owners can approve/reject
        if ((targetUserRole === 'manager' || targetUserRole === 'owner') && authUser.role !== 'owner') {
            return errorResponse('Leave requests for Managers/Owners must be approved by an Owner.', 403);
        }

        // 3. Update status and manager info
        const updateData: any = {
            status,
            reviewed_by: authUser.user_id,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (status === 'rejected' && rejection_reason) {
            updateData.rejection_reason = rejection_reason;
        }

        // Optionally append a manager note to the reason field
        if (manager_note) {
            updateData.reason = current.reason ? `${current.reason}\n\nManager Note: ${manager_note}` : `Manager Note: ${manager_note}`;
        }

        const { data, error } = await supabase
            .from('LeaveRequest')
            .update(updateData)
            .eq('request_id', id)
            .select()
            .single();

        if (error) return errorResponse(error.message);

        await logAudit({
            businessId: authUser.business_id,
            tableName: 'LeaveRequest',
            recordId: id,
            action: 'UPDATE',
            changedBy: authUser.user_id,
            beforeValue: current,
            afterValue: data,
            reason: `Leave request ${status}`
        });

        // 4. If approved, update LeaveBalance
        if (status === 'approved') {
            const year = new Date(current.start_date).getFullYear();

            const { data: balance, error: balanceError } = await supabase
                .from('LeaveBalance')
                .select('*')
                .eq('employee_id', targetEmployeeId)
                .eq('leave_type_id', current.leave_type_id)
                .eq('year', year)
                .single();

            if (!balanceError && balance) {
                await supabase
                    .from('LeaveBalance')
                    .update({
                        taken_hours: Number(balance.taken_hours) + Number(current.total_hours),
                        updated_at: new Date().toISOString()
                    })
                    .eq('balance_id', balance.balance_id);
            }
        }

        return successResponse(data, `Leave request ${status}`);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * DELETE /api/leave/[id]
 * 
 * Cancel a leave request
 * Access: Owner, Manager, Employee (if pending)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();

        // 1. Fetch to check permissions
        const { data: current, error: fetchError } = await supabase
            .from('LeaveRequest')
            .select('*')
            .eq('request_id', id)
            .single();

        if (fetchError || !current) return errorResponse('Leave request not found', 404);

        // Security: Employees can only delete their own PENDING requests
        if (authUser.role !== 'owner' && authUser.role !== 'manager') {
            if (current.employee_id !== authUser.employee_id) return errorResponse('Forbidden', 403);
            if (current.status !== 'pending') return errorResponse('Cannot delete a processed leave request', 400);
        }

        const { error } = await supabase
            .from('LeaveRequest')
            .delete()
            .eq('request_id', id);

        if (error) return errorResponse(error.message);
        return successResponse(null, 'Leave request cancelled successfully');
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
