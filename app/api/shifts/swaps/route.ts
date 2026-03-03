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
        const status = searchParams.get('status');

        let query = supabase
            .from('ShiftSwapRequest')
            .select(`
        *,
        Shift:shift_id(*),
        Requester:requester_id(employee_id, first_name, last_name),
        TargetEmployee:target_employee_id(employee_id, first_name, last_name),
        TargetShift:target_shift_id(*)
      `)
            .eq('business_id', authUser.business_id)
            .order('created_at', { ascending: false });

        // Managers see everything for their business
        // Employees see only their relevant requests
        if (authUser.role === 'employee') {
            const employeeId = authUser.employee_id;
            query = query.or(`requester_id.eq.${employeeId},target_employee_id.eq.${employeeId}`);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data: swaps, error } = await query;

        if (error) return errorResponse(error.message, 400);

        return successResponse(swaps);
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
 * 
 * Body:
 * {
 *   "shift_id": "uuid",
 *   "target_employee_id": "uuid" (optional, for direct swap/invite),
 *   "target_shift_id": "uuid" (optional, for 1-for-1 swap)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('employee', 'manager', 'owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['shift_id']);
        if (validationError) return errorResponse(validationError, 400);

        const { shift_id, target_employee_id, target_shift_id } = body;
        const employeeId = authUser.employee_id;

        // Note: for owners/managers, they might not have an employee_id if they aren't rostered.
        // In our system, Managers HAVE an employee record. Owners might not.
        if (!employeeId && authUser.role === 'employee') {
            return errorResponse('You do not have an employee profile linked to your account.', 403);
        }

        const supabase = await createClient();

        // 1. Verify ownership of the shift
        const { data: shift, error: shiftError } = await supabase
            .from('Shift')
            .select('*')
            .eq('shift_id', shift_id)
            .eq('business_id', authUser.business_id)
            .single();

        if (shiftError || !shift) return errorResponse('Shift not found', 404);

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

        // Safety: typically only the employee who owns the shift can offer it
        if (shift.employee_id !== employeeId && authUser.role === 'employee') {
            return errorResponse('You can only offer your own shifts.', 403);
        }

        // 2. Create the request
        const { data: swapRequest, error: swapError } = await supabase
            .from('ShiftSwapRequest')
            .insert({
                business_id: authUser.business_id,
                requester_id: employeeId || shift.employee_id, // fallback if owner is acting on someone's behalf
                shift_id,
                target_employee_id: target_employee_id || null,
                target_shift_id: target_shift_id || null,
                status: target_employee_id ? 'pending_acceptance' : 'pending_approval'
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
