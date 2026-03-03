import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getAuthUser } from '@/lib/auth';
import {
    successResponse,
    errorResponse,
    validateRequiredFields
} from '@/lib/api-helpers';
import { LeaveRequestInsert } from '@/types/database';
import { checkLeaveConflicts } from '@/lib/leave-logic';

/**
 * GET /api/leave
 * 
 * List leave requests
 * Access: Owner, Manager, Employee (own)
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employee_id');
        const status = searchParams.get('status');

        const supabase = await createClient();
        let query = supabase
            .from('LeaveRequest')
            .select('*, LeaveType(*), Employee(first_name, last_name)')
            .eq('business_id', authUser.business_id);

        // Security: Employees can only see their own leave
        if (authUser.role !== 'owner' && authUser.role !== 'manager') {
            query = query.eq('employee_id', authUser.employee_id);
        } else if (employeeId) {
            query = query.eq('employee_id', employeeId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) return errorResponse(error.message);
        return successResponse(data);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * POST /api/leave
 * 
 * Create a new leave request
 * Access: Owner, Manager, Employee
 * 
 * Body:
 * {
 *   "leave_type_id": "uuid",
 *   "start_date": "2026-12-01",
 *   "end_date": "2026-12-05",
 *   "total_hours": 38,
 *   "reason": "Family trip",
 *   "employee_id": "uuid" (optional, for admin use),
 *   "document_url": "url" (optional)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['leave_type_id', 'start_date', 'end_date', 'total_hours']);
        if (validationError) return errorResponse(validationError, 400);

        const { leave_type_id, start_date, end_date, total_hours, reason, employee_id, document_url } = body;

        // Security: Only owners/managers can request leave for others
        const targetEmployeeId = (authUser.role === 'owner' || authUser.role === 'manager')
            ? (employee_id || authUser.employee_id)
            : authUser.employee_id;

        // Check for conflicts
        const conflicts = await checkLeaveConflicts(authUser.business_id, targetEmployeeId, start_date, end_date);

        if (conflicts.length > 0) {
            return errorResponse(`Conflict detected: Employee already has ${conflicts.length} shift(s) rostered during this period.`, 409);
        }

        const supabase = await createClient();
        const leaveData: LeaveRequestInsert = {
            business_id: authUser.business_id,
            employee_id: targetEmployeeId,
            leave_type_id,
            start_date,
            end_date,
            total_hours,
            status: 'pending',
            reason: reason || null,
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
            document_url: document_url || null
        };

        const { data, error } = await supabase
            .from('LeaveRequest')
            .insert(leaveData)
            .select()
            .single();

        if (error) return errorResponse(error.message);
        return successResponse(data, 'Leave request submitted successfully', 201);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
