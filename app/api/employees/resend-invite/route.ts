import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * POST /api/employees/resend-invite
 * 
 * Resend the invitation email for a pending (invited) employee.
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "employee_id": "EMP-XXXXX"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['employee_id']);
        if (validationError) return errorResponse(validationError, 400);

        const { employee_id } = body;

        const supabase = await createClient();

        // 1. Find the employee
        const { data: employee, error } = await supabase
            .from('Employee')
            .select('employee_id, email, status, first_name, last_name')
            .eq('employee_id', employee_id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error || !employee) return errorResponse('Employee not found', 404);
        if (employee.status !== 'invited') {
            return errorResponse('Can only resend invites for employees with "invited" status', 400);
        }

        // 2. Generate a new invite link
        const adminClient = createAdminClient();
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: 'invite',
            email: employee.email,
            options: {
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/onboarding`,
            }
        });

        if (linkError) {
            return errorResponse(`Failed to resend invite: ${linkError.message}`, 500);
        }

        return successResponse({
            invite_link: linkData?.properties?.action_link || null,
            email: employee.email,
        }, `Invitation resent to ${employee.email}`);
    } catch (error: any) {
        console.error('Resend invite error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}
