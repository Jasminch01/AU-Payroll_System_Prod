import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import bcrypt from 'bcryptjs';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/managers/[id]
 * 
 * Get a specific manager profile
 * Access: Owner
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id } = await params;
        const supabase = await createClient();

        // 1. Fetch User Record
        const { data: user, error: userError } = await supabase
            .from('User')
            .select('*')
            .eq('user_id', id)
            .eq('business_id', authUser.business_id)
            .eq('role', 'manager')
            .single();

        if (userError || !user) {
            return errorResponse('Manager not found', 404);
        }

        // 2. Fetch Employee Record separately
        const { data: employee, error: empError } = await supabase
            .from('Employee')
            .select('employee_id, first_name, last_name, phone, email, dob, bank_details, emergency_contact_name, emergency_contact_phone, employment_type, role_title, pay_cycle, start_date, end_date, created_at, updated_at, business_id, user_id, status')
            .eq('user_id', id)
            .single();

        if (empError) {
            // Log it but we still have the user profile
            console.error('Error fetching employee details for manager:', empError);
        }

        const manager = {
            ...user,
            Employee: employee || null
        };

        return successResponse(manager);
    } catch (error) {
        console.error('Get manager error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PUT /api/managers/[id]
 * 
 * Update a manager's profile
 * Access: Owner
 * 
 * Body:
 * {
 *   "first_name": "Jane",
 *   "last_name": "Smith",
 *   "phone": "0412345678",
 *   "status": "active",
 *   ...
 * }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        // 1. Update User Record
        const userFields: Record<string, any> = {};
        if (body.first_name) userFields.first_name = body.first_name;
        if (body.last_name) userFields.last_name = body.last_name;
        userFields.updated_at = new Date().toISOString();

        if (Object.keys(userFields).length > 1) {
            const { error: userError } = await supabase
                .from('User')
                .update(userFields)
                .eq('user_id', id)
                .eq('business_id', authUser.business_id);

            if (userError) return errorResponse(`Update user failed: ${userError.message}`, 400);
        }

        // 2. Update Employee Record
        const employeeFields: Record<string, any> = {};
        const allowedEmployeeFields = [
            'first_name', 'last_name', 'phone', 'dob', 'bank_details',
            'emergency_contact_name', 'emergency_contact_phone',
            'employment_type', 'role_title', 'pay_cycle', 'kiosk_pin',
            'end_date', 'status'
        ];

        for (const field of allowedEmployeeFields) {
            if (body[field] !== undefined) {
                if (field === 'kiosk_pin') {
                    employeeFields[field] = await bcrypt.hash(body[field], 10);
                } else {
                    employeeFields[field] = body[field];
                }
            }
        }

        if (Object.keys(employeeFields).length > 0) {
            employeeFields.updated_at = new Date().toISOString();
            const { error: empError } = await supabase
                .from('Employee')
                .update(employeeFields)
                .eq('user_id', id)
                .eq('business_id', authUser.business_id);

            if (empError) return errorResponse(`Update employee failed: ${empError.message}`, 400);
        }

        return successResponse(null, 'Manager and employee records updated successfully');
    } catch (error) {
        console.error('Update manager error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/managers/[id]
 * 
 * Delete a manager profile and account
 * Access: Owner
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id } = await params;
        const supabase = await createClient();

        // Verify manager belongs to this business
        const { data: manager, error: findError } = await supabase
            .from('User')
            .select('*')
            .eq('user_id', id)
            .eq('business_id', authUser.business_id)
            .eq('role', 'manager')
            .single();

        if (findError || !manager) {
            return errorResponse('Manager not found', 404);
        }

        // Delete Employee record first (to avoid FK issues if any)
        await supabase.from('Employee').delete().eq('user_id', id);

        // Delete User record
        await supabase.from('User').delete().eq('user_id', id);

        // Delete auth account
        const adminClient = createAdminClient();
        await adminClient.auth.admin.deleteUser(id);

        return successResponse(null, 'Manager and employee records deleted successfully');
    } catch (error) {
        console.error('Delete manager error:', error);
        return errorResponse('Internal server error', 500);
    }
}
