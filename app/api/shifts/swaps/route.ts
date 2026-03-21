import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * GET /api/shifts/swaps
 * 
 * List swap requests
 * Access: Owner, Manager, Employee (own)
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        let query = supabase
            .from('ShiftSwapRequest')
            .select(`
                *,
                Shift:shift_id(*),
                Requester:requester_id(employee_id, first_name, last_name, user_id),
                TargetEmployee:target_employee_id(employee_id, first_name, last_name),
                TargetShift:target_shift_id(*)
            `)
            .eq('business_id', authUser.business_id)
            .order('created_at', { ascending: false });

        // Employees see only their relevant requests AND open pool offers
        if (authUser.role === 'employee') {
            const employeeId = authUser.employee_id;
            query = query.or(`requester_id.eq.${employeeId},target_employee_id.eq.${employeeId},target_employee_id.is.null`);
        }

        const { data: swaps, error } = await query;

        if (error) return errorResponse(error.message, 400);

        let filteredSwaps = swaps || [];

        // Pre-fetch roles for filtering
        const requesterUserIds = filteredSwaps.map(s => s.Requester?.user_id).filter(Boolean);
        const roleMap = new Map<string, string>();
        if (requesterUserIds.length > 0) {
            const { data: userRoles } = await supabase
                .from('User')
                .select('user_id, role')
                .in('user_id', requesterUserIds);
            (userRoles || []).forEach(u => roleMap.set(u.user_id, u.role));
        }

        // Post-filter logic for Roles and Pool
        if (authUser.role === 'employee') {
            const employeeId = authUser.employee_id;
            filteredSwaps = filteredSwaps.filter((swap: any) => {
                const isPersonal = swap.requester_id === employeeId || swap.target_employee_id === employeeId;
                const isOpenPool = !swap.target_employee_id && swap.status === 'pending_approval';

                if (isOpenPool) {
                    const reqRole = roleMap.get(swap.Requester?.user_id) || 'employee';
                    return reqRole === 'employee' && swap.requester_id !== employeeId;
                }
                return isPersonal;
            });
        } else if (authUser.role === 'manager') {
            const employeeId = authUser.employee_id;
            filteredSwaps = filteredSwaps.filter((swap: any) => {
                const reqRole = roleMap.get(swap.Requester?.user_id) || 'employee';
                const isOwnSwap = employeeId && (swap.requester_id === employeeId || swap.target_employee_id === employeeId);
                const isOpenForManagers = !swap.target_employee_id && reqRole === 'manager' && swap.requester_id !== employeeId;
                
                return reqRole === 'employee' || isOwnSwap || isOpenForManagers;
            });
        }

        return successResponse(filteredSwaps);
    } catch (err) {
        console.error('List swaps error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/shifts/swaps
 * 
 * Initiate a shift swap or drop
 * Access: Employee, Manager, Owner
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('employee', 'manager', 'owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['shift_id']);
        if (validationError) return errorResponse(validationError, 400);

        const { shift_id, target_employee_id, target_shift_id, pool_type } = body;
        const employeeId = authUser.employee_id;

        if (!employeeId && authUser.role === 'employee') {
            return errorResponse('You do not have an employee profile linked to your account.', 403);
        }

        const supabase = await createClient();

        // 1. Verify ownership of the shift (No join to User here to avoid PGRST200)
        const { data: shift, error: shiftError } = await supabase
            .from('Shift')
            .select('*')
            .eq('shift_id', shift_id)
            .eq('business_id', authUser.business_id)
            .single();

        if (shiftError || !shift) {
            console.error('Shift query error:', shiftError);
            return errorResponse('Shift not found or access denied.', 404);
        }

        // Fetch the employee linked to the shift separately to avoid join errors
        const { data: shiftEmployee } = await supabase
            .from('Employee')
            .select('user_id')
            .eq('employee_id', shift.employee_id)
            .single();

        // --- ROLE VALIDATIONS (Manual Lookups) ---
        let requesterRole = 'employee';
        if (shiftEmployee?.user_id) {
            const { data: userData } = await supabase
                .from('User')
                .select('role')
                .eq('user_id', shiftEmployee.user_id)
                .single();
            if (userData) requesterRole = userData.role;
        }

        if (target_employee_id) {
            const { data: targetEmployee } = await supabase
                .from('Employee')
                .select('user_id')
                .eq('employee_id', target_employee_id)
                .single();

            if (!targetEmployee) return errorResponse('Target employee not found.', 404);

            let targetRole = 'employee';
            if (targetEmployee.user_id) {
                const { data: userData } = await supabase
                    .from('User')
                    .select('role')
                    .eq('user_id', targetEmployee.user_id)
                    .single();
                if (userData) targetRole = userData.role;
            }

            if (requesterRole === 'employee' && targetRole !== 'employee') {
                return errorResponse('Employees can only swap shifts with other Employees.', 403);
            }

            if (requesterRole === 'manager' && targetRole !== 'manager') {
                return errorResponse('Managers can only swap shifts with other Managers.', 403);
            }
        }
        // ------------------------

        // --- TIME VALIDATION ---
        const startTime = new Date(shift.start_time);
        const now = new Date();
        const twoHoursFromNow = new Date(now.getTime() + (2 * 60 * 60 * 1000));

        if (startTime <= now) {
            return errorResponse('Cannot swap a shift that has already started or passed.', 400);
        }

        if (startTime < twoHoursFromNow) {
            return errorResponse('Swap requests must be made at least 2 hours before the shift starts.', 400);
        }
        // -----------------------

        if (shift.employee_id !== employeeId && authUser.role === 'employee') {
            return errorResponse('You can only offer your own shifts.', 403);
        }

        // 1b. Prevent duplicate active requests for the same shift
        const { data: existingRequest } = await supabase
            .from('ShiftSwapRequest')
            .select('request_id')
            .eq('shift_id', shift_id)
            .in('status', ['pending_acceptance', 'pending_approval'])
            .limit(1)
            .maybeSingle();

        if (existingRequest) {
            return errorResponse('This shift already has an active swap or transfer request.', 409);
        }

        // --- SWAP-SPECIFIC VALIDATIONS ---
        if (target_shift_id) {
            if (!target_employee_id) {
                return errorResponse('A target employee must be specified for a two-way swap.', 400);
            }

            // Verify target shift belongs to target employee
            const { data: targetShift, error: targetShiftError } = await supabase
                .from('Shift')
                .select('*')
                .eq('shift_id', target_shift_id)
                .eq('employee_id', target_employee_id)
                .single();

            if (targetShiftError || !targetShift) {
                return errorResponse('The shift you are trying to swap with was not found for this colleague.', 400);
            }

            // Prevent identical shift swap
            if (shift.start_time === targetShift.start_time && shift.end_time === targetShift.end_time) {
                return errorResponse('These shifts have identical times. Swapping is redundant.', 400);
            }

            // Check if requester has a conflict with the new shift (Sarah takes Angela's 1-5)
            const { data: requesterConflictingShifts } = await supabase
                .from('Shift')
                .select('shift_id')
                .eq('employee_id', employeeId || shift.employee_id)
                .neq('shift_id', shift_id) // Exclude the shift being given away
                .lt('start_time', targetShift.end_time)
                .gt('end_time', targetShift.start_time);

            if (requesterConflictingShifts && requesterConflictingShifts.length > 0) {
                return errorResponse('The shift you are taking conflicts with your other existing shifts.', 400);
            }

            // Check if target employee has a conflict with Sarah's shift (Angela takes Sarah's 9-1)
            const { data: targetConflictingShifts } = await supabase
                .from('Shift')
                .select('shift_id')
                .eq('employee_id', target_employee_id)
                .neq('shift_id', target_shift_id) // Exclude the shift they are giving away
                .lt('start_time', shift.end_time)
                .gt('end_time', shift.start_time);

            if (targetConflictingShifts && targetConflictingShifts.length > 0) {
                return errorResponse('The shift your colleague is taking conflicts with their other existing shifts.', 400);
            }
        }
        // ---------------------------------

        // 2. Create the request
        const { data: swapRequest, error: swapError } = await supabase
            .from('ShiftSwapRequest')
            .insert({
                business_id: authUser.business_id,
                requester_id: employeeId || shift.employee_id,
                shift_id,
                target_employee_id: target_employee_id || null,
                target_shift_id: target_shift_id || null,
                status: target_employee_id ? 'pending_acceptance' : 'pending_approval',
                manager_note: !target_employee_id ? (pool_type || 'transfer') : null
            })
            .select()
            .single();

        if (swapError) return errorResponse(swapError.message, 400);

        return successResponse(swapRequest, 'Swap request created successfully', 201);
    } catch (err) {
        console.error('Create swap error:', err);
        return errorResponse('Internal server error', 500);
    }
}
