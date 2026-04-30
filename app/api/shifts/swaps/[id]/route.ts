import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * PUT /api/shifts/swaps/[id]
 * 
 * Handle multi-stage swap actions
 * Access: Owner, Manager, Employee (involved)
 * 
 * Body:
 * {
 *   "action": "accept" | "decline" | "approve" | "reject" | "cancel",
 *   "manager_note": "string" (optional)
 * }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        // Employees must have an employee_id linked to their account
        if (authUser.role === 'employee' && !authUser.employee_id) {
            return errorResponse('Valid employee profile required to manage shift swaps.', 401);
        }

        const { id } = await params;
        const body = await request.json();
        const { action, manager_note } = body; // action: 'accept' | 'decline' | 'approve' | 'reject' | 'cancel'

        const supabase = await createClient();

        // 1. Fetch the request (avoiding joins due to potential RLS/PostgREST issues)

        const { data: swapRequest, error: findError } = await supabase
            .from('ShiftSwapRequest')
            .select('*')
            .eq('request_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !swapRequest) {
            console.error(`[Swap API] Request not found or error:`, findError);
            return errorResponse('Swap request not found', 404);
        }

        // Fetch related shift separately
        const { data: shift, error: shiftError } = await supabase
            .from('Shift')
            .select('*')
            .eq('shift_id', swapRequest.shift_id)
            .single();

        if (shiftError || !shift) return errorResponse('Original shift not found', 404);
        swapRequest.Shift = shift;

        const employeeId = authUser.employee_id;

        // 2. Handle Actions

        // ACTION: Cancel (by Requester)
        if (action === 'cancel') {
            if (swapRequest.requester_id !== employeeId && authUser.role !== 'owner') {
                return errorResponse('Only the requester can cancel this.', 403);
            }
            const { error } = await supabase
                .from('ShiftSwapRequest')
                .delete()
                .eq('request_id', id);

            if (error) return errorResponse(error.message, 400);
            return successResponse(null, 'Request permanently removed.');
        }

        // ACTION: Accept/Decline (by Target Employee or Pool Claimant)
        if (action === 'accept' || action === 'decline') {
            const isPoolClaim = !swapRequest.target_employee_id && swapRequest.status === 'pending_acceptance';

            if (!isPoolClaim && swapRequest.target_employee_id !== employeeId) {
                return errorResponse('Only the target employee can respond to this invitation.', 403);
            }

            // Conflict & Role Check for Pool Claims
            if (isPoolClaim && action === 'accept') {
                if (!employeeId) return errorResponse('Valid employee profile required to claim shifts.', 401);

                // Role check removed: any qualified employee can claim based on your new requirement.

                // 2. Overlap Check (Safety Rail)
                const { data: conflicts } = await supabase
                    .from('Shift')
                    .select('shift_id')
                    .eq('employee_id', employeeId)
                    .lt('start_time', swapRequest.Shift.end_time)
                    .gt('end_time', swapRequest.Shift.start_time);

                if (conflicts && conflicts.length > 0) {
                    return errorResponse('You cannot claim this shift because you have an overlapping shift.', 400);
                }
            }

            const newStatus = action === 'accept' ? 'pending_approval' : 'rejected';
            const updateFields: any = { status: newStatus, updated_at: new Date().toISOString() };
            
            if (isPoolClaim && action === 'accept') {
                updateFields.target_employee_id = employeeId;
            }

            const { error } = await supabase
                .from('ShiftSwapRequest')
                .update(updateFields)
                .eq('request_id', id);

            if (error) return errorResponse(error.message, 400);

            // 1. Notify Manager that a swap/transfer is now ready for approval
            if (action === 'accept') {
                try {
                    const { data: managers } = await supabase
                        .from('User')
                        .select('user_id')
                        .eq('business_id', authUser.business_id)
                        .in('role', ['manager', 'owner']);
                    
                    const managerUserIds = (managers || []).map(m => m.user_id);
                    if (managerUserIds.length > 0) {
                        await createNotification({
                            business_id: authUser.business_id,
                            user_ids: managerUserIds,
                            actor_id: authUser.user_id,
                            type: 'SHIFT_SWAP_REQUESTED',
                            title: swapRequest.target_shift_id ? 'Swap Ready for Approval' : 'Transfer Ready for Approval',
                            message: `A shift ${swapRequest.target_shift_id ? 'swap' : 'transfer'} was accepted and needs your final approval.`,
                            entity_id: id,
                            entity_type: 'shift_swap_request'
                        });
                    }
                } catch (notifyErr) {
                    console.error('Failed to notify managers:', notifyErr);
                }
            }

            // 2. Notify the Requester about the decision
            try {
                const { data: requester } = await supabase
                    .from('Employee')
                    .select('user_id')
                    .eq('employee_id', swapRequest.requester_id)
                    .single();

                if (requester?.user_id) {
                    await createNotification({
                        business_id: authUser.business_id,
                        user_ids: [requester.user_id],
                        actor_id: authUser.user_id,
                        type: action === 'accept' ? 'SHIFT_SWAP_ACCEPTED' : 'SHIFT_SWAP_REJECTED',
                        title: action === 'accept' ? 'Shift Request Accepted' : 'Shift Request Declined',
                        message: action === 'accept'
                            ? `${authUser.first_name || 'A colleague'} accepted your shift request. It is now awaiting manager approval.`
                            : `${authUser.first_name || 'A colleague'} declined your shift request.`,
                        entity_id: id,
                        entity_type: 'shift_swap_request'
                    });
                }
            } catch (notifyErr) {
                console.error('Failed to notify requester:', notifyErr);
            }

            return successResponse(null, action === 'accept' 
                ? 'Request accepted. Awaiting manager approval.' 
                : 'Request declined successfully.');
        }

        // ACTION: Approve/Reject (by Manager/Owner)
        if (action === 'approve' || action === 'reject') {
            if (authUser.role !== 'manager' && authUser.role !== 'owner') {
                return errorResponse('Only managers or owners can approve/reject swaps.', 403);
            }

            if (swapRequest.status !== 'pending_approval') {
                return errorResponse('This request is not awaiting manager approval.', 400);
            }

            // --- ROLE VALIDATION FOR APPROVAL ---
            // If the requester is a manager, only an owner can approve it.
            const { data: requesterEmp, error: reqEmpError } = await supabase
                .from('Employee')
                .select('user_id')
                .eq('employee_id', swapRequest.requester_id)
                .single();

            let reqRole = 'employee';
            if (requesterEmp?.user_id) {
                const { data: userData } = await supabase
                    .from('User')
                    .select('role')
                    .eq('user_id', requesterEmp.user_id)
                    .single();
                if (userData) reqRole = userData.role;
            }

            if (reqRole === 'manager' && authUser.role !== 'owner') {
                return errorResponse('Only an owner can approve a manager\'s shift swap request.', 403);
            }
            // ------------------------------------

            if (action === 'approve') {
                // --- POINT OF NO RETURN CHECK ---
                const shiftStart = new Date(swapRequest.Shift.start_time);
                const now = new Date();

                if (shiftStart <= now) {
                    // Auto-update status to expired if the manager tries to approve too late
                    await supabase
                        .from('ShiftSwapRequest')
                        .update({ status: 'expired', updated_at: now.toISOString() })
                        .eq('request_id', id);

                    return errorResponse('This shift has already started or passed. The request has expired.', 400);
                }
                // --------------------------------

                // Logic for approval:
                // We need to swap the employees on the shifts.

                // If it's a "Drop/Claim" (target_employee_id exists but no target_shift_id)
                // OR it's a direct swap (both exist)

                // This is a simplified version: update the primary shift
                // If it was an open offer, the target_employee_id would be filled by whoever claimed it 
                // (we'd need a separate 'claim' action, but for now let's assume acceptance is claiming)

                // 1. Update the original shift
                const targetEmpId = swapRequest.target_employee_id;

                // If targetEmpId is null, it's a "Drop to Pool" that the manager is approving.
                // This will make the shift an "Open Shift" (employee_id = null).
                // We allow this if the manager is approving the drop.
                const updateValue = targetEmpId || null;

                // Transactional update (pseudo-code, using Supabase sequential calls)
                const { error: shift1Err } = await supabase
                    .from('Shift')
                    .update({ employee_id: updateValue, updated_at: new Date().toISOString() })
                    .eq('shift_id', swapRequest.shift_id);

                if (shift1Err) return errorResponse('Failed to update primary shift', 400);

                // 2. If it was a swap, update the requester's identity on the target shift
                if (swapRequest.target_shift_id) {
                    const { error: shift2Err } = await supabase
                        .from('Shift')
                        .update({ employee_id: swapRequest.requester_id, updated_at: new Date().toISOString() })
                        .eq('shift_id', swapRequest.target_shift_id);

                    if (shift2Err) console.error('Warning: secondary shift update failed', shift2Err);
                }
            }

            // Update the request status
            const { error } = await supabase
                .from('ShiftSwapRequest')
                .update({
                    status: action === 'approve' ? 'approved' : 'rejected',
                    manager_id: authUser.user_id,
                    manager_note: manager_note || null,
                    updated_at: new Date().toISOString()
                })
                .eq('request_id', id);

            if (error) return errorResponse(error.message, 400);

            // Notify involved employees about manager's decision
            try {
                const { data: requester } = await supabase.from('Employee').select('user_id').eq('employee_id', swapRequest.requester_id).single();
                const { data: target } = swapRequest.target_employee_id 
                    ? await supabase.from('Employee').select('user_id').eq('employee_id', swapRequest.target_employee_id).single()
                    : { data: null };

                const involvedUserIds = [requester?.user_id, target?.user_id].filter(Boolean) as string[];
                
                if (involvedUserIds.length > 0) {
                    const isSwap = !!swapRequest.target_shift_id;
                    await createNotification({
                        business_id: authUser.business_id,
                        user_ids: involvedUserIds,
                        actor_id: authUser.user_id,
                        type: 'SHIFT_SWAP_REQUESTED', // Or another appropriate type
                        title: action === 'approve' 
                            ? `Shift ${isSwap ? 'Swap' : 'Transfer'} Approved` 
                            : `Shift ${isSwap ? 'Swap' : 'Transfer'} Rejected`,
                        message: action === 'approve'
                            ? `The ${isSwap ? 'swap' : 'transfer'} has been approved and shifts have been updated.`
                            : `The ${isSwap ? 'swap' : 'transfer'} request was rejected by a manager. ${manager_note ? `Reason: ${manager_note}` : ''}`,
                        entity_id: id,
                        entity_type: 'shift_swap_request'
                    });
                }
            } catch (notifyErr) {
                console.error('Failed to notify employees of decision:', notifyErr);
            }

            return successResponse(null, action === 'approve' ? 'Request approved successfully' : 'Request rejected');
        }

        return errorResponse('Invalid action', 400);
    } catch (err) {
        console.error('Update swap action error:', err);
        return errorResponse('Internal server error', 500);
    }
}
