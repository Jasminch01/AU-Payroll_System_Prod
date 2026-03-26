import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { getSiteUrl } from '@/lib/utils/url';

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

        let inviteSent = false;
        let actionLink: string | null = null;

        // 2. Resend invite via Supabase (sends email)
        const adminClient = createAdminClient();
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(employee.email, {
            data: {
                first_name: employee.first_name,
                last_name: employee.last_name,
                business_id: authUser.business_id,
            },
            redirectTo: `${getSiteUrl()}/onboarding`,
        });

        if (inviteError) {
            // If email failed, try to at least get a manual link
            const { data: linkData } = await adminClient.auth.admin.generateLink({
                type: 'invite',
                email: employee.email,
                options: {
                    redirectTo: `${getSiteUrl()}/onboarding`,
                }
            });
            
            if (linkData?.properties?.action_link) {
                actionLink = linkData.properties.action_link;
            } else {
                return errorResponse(`Failed to resend invitation: ${inviteError.message}`, 500);
            }
        } else {
            inviteSent = true;
        }

        return successResponse({
            invite_link: actionLink,
            email: employee.email,
        }, inviteSent ? `Invitation resent to ${employee.email}` : `Email failed to send, but invite link is ready.`);
    } catch (error: any) {
        console.error('Resend invite error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}
