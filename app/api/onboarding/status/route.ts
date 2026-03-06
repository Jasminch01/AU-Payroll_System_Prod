import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/onboarding/status
 * 
 * Check the onboarding status of the currently authenticated user.
 * Used by the frontend to determine if the user needs to complete onboarding.
 * Access: Authenticated user
 * 
 * Returns:
 * {
 *   "needs_onboarding": true/false,
 *   "employee": { employee details },
 *   "business_name": "Acme Corp"
 * }
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return errorResponse('Not authenticated', 401);
        }

        // Look up the employee record
        const { data: employee, error: empError } = await supabase
            .from('Employee')
            .select('employee_id, first_name, last_name, email, status, business_id, role_title')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!employee) {
            // No employee record — might be a pure owner (created via /register)
            return successResponse({
                needs_onboarding: false,
                is_owner: true,
            });
        }

        // Fetch business name for the onboarding welcome screen
        const { data: business } = await supabase
            .from('Business')
            .select('business_name')
            .eq('business_id', employee.business_id)
            .single();

        return successResponse({
            needs_onboarding: employee.status === 'invited',
            employee: {
                employee_id: employee.employee_id,
                first_name: employee.first_name,
                last_name: employee.last_name,
                email: employee.email,
                role_title: employee.role_title,
                status: employee.status,
            },
            business_name: business?.business_name || 'Your Business',
        });
    } catch (error: any) {
        console.error('Onboarding status error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}
