import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

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

        const { id } = await params;
        const body = await request.json();
        const { action, manager_note } = body; // action: 'accept' | 'decline' | 'approve' | 'reject' | 'cancel'

        const supabase = await createClient();

        // 1. Fetch the request
        const { data: swapRequest, error: findError } = await supabase
            .from('ShiftSwapRequest')
            .select('*, Shift:shift_id(*)')
            .eq('request_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !swapRequest) return errorResponse('Swap request not found', 404);

        const employeeId = authUser.employee_id;

        // 2. Handle Actions

        // ACTION: Cancel (by Requester)
        if (action === 'cancel') {
            if (swapRequest.requester_id !== employeeId && authUser.role !== 'owner') {
                return errorResponse('Only the requester can cancel this.', 403);
            }
            const { error } = await supabase
                .from('ShiftSwapRequest')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('request_id', id);
            if (error) return errorResponse(error.message, 400);
            return successResponse(null, 'Request cancelled');
        }

        // ACTION: Accept/Decline (by Target Employee)
        if (action === 'accept' || action === 'decline') {
            if (swapRequest.target_employee_id !== employeeId) {
                return errorResponse('Only the target employee can respond to this invitation.', 403);
            }
            if (swapRequest.status !== 'pending_acceptance') {
                return errorResponse('This request is no longer awaiting acceptance.', 400);
            }

            const newStatus = action === 'accept' ? 'pending_approval' : 'rejected';
            const { error } = await supabase
                .from('ShiftSwapRequest')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('request_id', id);

            if (error) return errorResponse(error.message, 400);
            return successResponse(null, action === 'accept' ? 'Accepted. Awaiting manager approval.' : 'Invitation declined.');
        }

        // ACTION: Approve/Reject (by Manager/Owner)
        if (action === 'approve' || action === 'reject') {
            if (authUser.role !== 'manager' && authUser.role !== 'owner') {
                return errorResponse('Only managers or owners can approve/reject swaps.', 403);
            }

            if (swapRequest.status !== 'pending_approval') {
                return errorResponse('This request is not awaiting manager approval.', 400);
            }

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

                if (!targetEmpId) {
                    return errorResponse('No player to swap with.', 400);
                }

                // Transactional update (pseudo-code, using Supabase sequential calls)
                const { error: shift1Err } = await supabase
                    .from('Shift')
                    .update({ employee_id: targetEmpId, updated_at: new Date().toISOString() })
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
            return successResponse(null, action === 'approve' ? 'Swap approved' : 'Swap rejected');
        }

        return errorResponse('Invalid action', 400);
    } catch (err) {
        console.error('Update swap action error:', err);
        return errorResponse('Internal server error', 500);
    }
}
