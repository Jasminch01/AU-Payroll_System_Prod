import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/auth/me
 * 
 * Get current authenticated user's profile and role
 * Access: Authenticated
 */
export async function GET() {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return errorResponse('Not authenticated', 401);
        }

        // Check User table (Owner/Manager)
        const { data: userRecord } = await supabase
            .from('User')
            .select('*, Business(*)')
            .eq('user_id', user.id)
            .single();

        if (userRecord) {
            // Check if manager/owner also has an employee profile
            const { data: linkedEmp } = await supabase
                .from('Employee')
                .select('employee_id')
                .eq('user_id', user.id)
                .single();

            return successResponse({
                user_id: user.id,
                email: user.email,
                role: userRecord.role,
                first_name: userRecord.first_name,
                last_name: userRecord.last_name,
                business_id: userRecord.business_id,
                business: userRecord.Business,
                employee_id: linkedEmp?.employee_id,
                can_order_liquor: userRecord.can_order_liquor ?? false,
            });
        }

        // Check Employee table
        const { data: employeeRecord } = await supabase
            .from('Employee')
            .select('*, Business:business_id(*)')
            .eq('user_id', user.id)
            .single();

        if (employeeRecord) {
            return successResponse({
                user_id: user.id,
                email: user.email,
                role: 'employee',
                employee_id: employeeRecord.employee_id,
                first_name: employeeRecord.first_name,
                last_name: employeeRecord.last_name,
                business_id: employeeRecord.business_id,
                business: employeeRecord.Business,
                status: employeeRecord.status,
                can_order_liquor: false,
            });
        }

        return errorResponse('User profile not found', 404);
    } catch (error) {
        console.error('Get user error:', error);
        return errorResponse('Internal server error', 500);
    }
}
