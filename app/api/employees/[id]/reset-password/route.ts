import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/employees/[id]/reset-password
 * 
 * Reset an employee's password by employee_id
 * Access: Owner only
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        // Only allow owners to reset employee passwords
        const authUser = await requireRole('owner');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id: employeeId } = await params;
        const body = await request.json().catch(() => ({}));
        const { password } = body;

        // Validation
        if (!password) {
            return errorResponse('Password is required', 400);
        }
        if (typeof password !== 'string' || password.length < 6) {
            return errorResponse('Password must be at least 6 characters long', 400);
        }

        const supabase = await createClient();

        // 1. Fetch the employee and verify they belong to the owner's business
        const { data: employee, error: fetchError } = await supabase
            .from('Employee')
            .select('employee_id, user_id, first_name, last_name, business_id')
            .eq('employee_id', employeeId)
            .eq('business_id', authUser.business_id)
            .single();

        if (fetchError || !employee) {
            return errorResponse('Employee not found in your business', 404);
        }

        // 2. Verify that they have a linked user_id
        if (!employee.user_id) {
            return errorResponse('This employee does not have a linked system user account. Password cannot be reset.', 400);
        }

        // 3. Reset the password in Supabase Auth using admin client
        const adminClient = createAdminClient();
        const { error: resetError } = await adminClient.auth.admin.updateUserById(
            employee.user_id,
            { password }
        );

        if (resetError) {
            console.error('Password reset failed via Admin API:', resetError.message);
            return errorResponse(`Failed to reset password: ${resetError.message}`, 500);
        }

        // 4. Log the audit event
        await logAudit({
            businessId: authUser.business_id,
            tableName: 'User',
            recordId: employee.user_id,
            action: 'UPDATE',
            changedBy: authUser.user_id,
            reason: `Owner reset password for employee ${employee.first_name} ${employee.last_name} (${employeeId})`
        });

        return successResponse({ success: true }, 'Password successfully reset');
    } catch (err: any) {
        console.error('[reset-password-api]', err);
        return errorResponse(err.message || 'Internal server error', 500);
    }
}
