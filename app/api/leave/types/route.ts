import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { LeaveTypeInsert } from '@/types/database';

/**
 * GET /api/leave/types
 * 
 * List leave types for the business
 * Access: Authenticated
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return errorResponse('Unauthorized', 401);

        // Get business_id from user's record (checking both tables)
        const { data: userData } = await supabase
            .from('User')
            .select('business_id')
            .eq('user_id', user.id)
            .single();

        let business_id = userData?.business_id;

        if (!business_id) {
            const { data: empData } = await supabase
                .from('Employee')
                .select('business_id')
                .eq('user_id', user.id)
                .single();
            business_id = empData?.business_id;
        }

        if (!business_id) return errorResponse('Business not found', 404);

        const { data, error } = await supabase
            .from('LeaveType')
            .select('*')
            .eq('business_id', business_id)
            .order('name', { ascending: true });

        if (error) return errorResponse(error.message);
        return successResponse(data);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * POST /api/leave/types
 * 
 * Create a new leave type
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "name": "Annual Leave",
 *   "is_paid": true (optional, default true),
 *   "accrual_rate": 0.0769 (optional),
 *   "max_carry_over": 40 (optional),
 *   "requires_doc": false (optional)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['name']);
        if (validationError) return errorResponse(validationError, 400);

        const { name, is_paid, accrual_rate, max_carry_over, requires_doc } = body;

        const supabase = await createClient();
        const insertData: LeaveTypeInsert = {
            business_id: authUser.business_id,
            name,
            is_paid: is_paid ?? true,
            accrual_rate: accrual_rate ?? null,
            max_carry_over: max_carry_over ?? null,
            requires_doc: requires_doc ?? false
        };

        const { data, error } = await supabase
            .from('LeaveType')
            .insert(insertData)
            .select()
            .single();

        if (error) return errorResponse(error.message);

        // Step 2: Initialize Leave Balances for all active employees for this new type
        const { data: employees } = await supabase
            .from('Employee')
            .select('employee_id')
            .eq('business_id', authUser.business_id)
            .eq('status', 'active');

        if (employees && employees.length > 0) {
            const currentYear = new Date().getFullYear();
            const balanceData = employees.map(emp => ({
                employee_id: emp.employee_id,
                leave_type_id: data.leave_type_id,
                business_id: authUser.business_id,
                accrued_hours: 0,
                taken_hours: 0,
                pending_hours: 0,
                year: currentYear,
                updated_at: new Date().toISOString()
            }));

            const { error: balanceErr } = await supabase.from('LeaveBalance').insert(balanceData);
            if (balanceErr) console.error('Bulk leave balance initialization failed:', balanceErr.message);
        }

        return successResponse(data, 'Leave type created and balances initialized', 201);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
