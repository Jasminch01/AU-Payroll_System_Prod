import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import bcrypt from 'bcryptjs';

/**
 * GET /api/managers
 * 
 * List all managers for the business
 * Access: Owner
 */
export async function GET() {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const supabase = await createClient();

        // Fetch Users (managers) first
        const { data: users, error: userError } = await supabase
            .from('User')
            .select('*')
            .eq('business_id', authUser.business_id)
            .eq('role', 'manager')
            .order('created_at', { ascending: false });

        if (userError) {
            return errorResponse(userError.message, 400);
        }

        if (!users || users.length === 0) {
            return successResponse([], 'No managers found');
        }

        // Fetch corresponding Employee details separately to avoid schema cache join issues
        const userIds = users.map(u => u.user_id);
        const { data: employees, error: empError } = await supabase
            .from('Employee')
            .select('employee_id, first_name, last_name, phone, email, dob, bank_details, emergency_contact_name, emergency_contact_phone, employment_type, role_title, pay_cycle, start_date, end_date, created_at, updated_at, business_id, user_id, status')
            .in('user_id', userIds);

        // Merge the data manually
        const managers = users.map(user => ({
            ...user,
            Employee: employees?.find(e => e.user_id === user.user_id) || null
        }));

        return successResponse(managers, `Found ${managers.length} manager(s)`);
    } catch (error) {
        console.error('List managers error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/managers
 * 
 * Create/invite a new manager
 * Access: Owner
 * 
 * Body:
 * {
 *   "email": "manager@example.com",
 *   "password": "tempPassword123",
 *   "first_name": "Jane",
 *   "last_name": "Smith",
 *   "dob": "1990-01-15",
 *   "bank_details": "BSB: 062..., Acc: 123...",
 *   "emergency_contact_name": "John Smith",
 *   "emergency_contact_phone": "0498765432",
 *   "role_title": "Shift Manager",
 *   "kiosk_pin": "5678",
 *   "start_date": "2026-03-01",
 *   "employee_id": "MGR001",
 *   "weekday_rate": 35.00
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const body = await request.json();

        // Validate required fields (both User and Employee)
        const validationError = validateRequiredFields(body, [
            'email',
            'password',
            'first_name',
            'last_name',
            'dob',
            'bank_details',
            'emergency_contact_name',
            'emergency_contact_phone',
            'role_title',
            'start_date',
            'employee_id',
            'weekday_rate',
        ]);
        if (validationError) {
            return errorResponse(validationError, 400);
        }

        const {
            email,
            password,
            first_name,
            last_name,
            phone,
            dob,
            bank_details,
            emergency_contact_name,
            emergency_contact_phone,
            employment_type,
            role_title,
            pay_cycle,
            start_date,
            end_date,
            employee_id,
            weekday_rate,
            saturday_multiplier = 1.25,
            sunday_multiplier = 1.50,
            public_holiday_multiplier = 2.50,
        } = body;

        if (password.length < 6) {
            return errorResponse('Password must be at least 6 characters', 400);
        }

        const adminClient = createAdminClient();

        // Step 1: Create auth user
        const { data: authData, error: authError } =
            await adminClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
            });

        if (authError) {
            return errorResponse(`Failed to create auth account: ${authError.message}`, 400);
        }

        if (!authData.user) {
            return errorResponse('Failed to create user account', 500);
        }

        const supabase = await createClient();

        // Step 2: Create User record (role = manager)
        const { error: userError } = await supabase
            .from('User')
            .insert({
                user_id: authData.user.id,
                business_id: authUser.business_id,
                role: 'manager',
                first_name,
                last_name,
            });

        if (userError) {
            await adminClient.auth.admin.deleteUser(authData.user.id);
            return errorResponse(`Failed to create manager profile: ${userError.message}`, 400);
        }


        const { error: employeeError } = await supabase
            .from('Employee')
            .insert({
                employee_id,
                first_name,
                last_name,
                phone: phone || null,
                email,
                dob,
                bank_details,
                emergency_contact_name,
                emergency_contact_phone,
                employment_type: employment_type || null,
                role_title,
                pay_cycle: pay_cycle || null,
                start_date,
                end_date: end_date || null,
                business_id: authUser.business_id,
                user_id: authData.user.id,
                status: 'active',
            });

        if (employeeError) {
            // Cleanup User and Auth
            await supabase.from('User').delete().eq('user_id', authData.user.id);
            await adminClient.auth.admin.deleteUser(authData.user.id);
            return errorResponse(`Failed to create employee record: ${employeeError.message}`, 400);
        }

        // Step 4: Create initial EmployeeRateHistory
        const { error: rateError } = await supabase
            .from('EmployeeRateHistory')
            .insert({
                employee_id,
                business_id: authUser.business_id,
                weekday_rate,
                saturday_multiplier,
                sunday_multiplier,
                public_holiday_multiplier,
                effective_from: start_date,
                created_bv: authUser.user_id,
            });

        if (rateError) {
            console.error('Rate history creation failed for manager:', rateError.message);
        }

        return successResponse(
            {
                user_id: authData.user.id,
                employee_id,
                email,
                role: 'manager',
                first_name,
                last_name,
                business_id: authUser.business_id,
            },
            'Manager created successfully with employee record',
            201
        );
    } catch (error) {
        console.error('Create manager error:', error);
        return errorResponse('Internal server error', 500);
    }
}
