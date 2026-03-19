import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';

/**
 * GET /api/employees
 * 
 * List all employees for the business
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner or Manager access required.', 401);
        }

        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status');

        let query = supabase
            .from('Employee')
            .select('employee_id, first_name, last_name, phone, email, dob, bank_details, emergency_contact_name, emergency_contact_phone, employment_type, role_title, pay_cycle, start_date, end_date, created_at, updated_at, business_id, user_id, status')
            .eq('business_id', authUser.business_id)
            .order('created_at', { ascending: false });

        if (statusFilter && ['active', 'inactive', 'invited'].includes(statusFilter)) {
            query = query.eq('status', statusFilter);
        }

        const { data: employees, error } = await query;

        if (error) {
            return errorResponse(error.message, 400);
        }

        return successResponse(employees, `Found ${employees.length} employee(s)`);
    } catch (error) {
        console.error('List employees error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/employees
 * 
 * Create a new employee and auth account
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "email": "employee@example.com",
 *   "password": "securepassword",
 *   "first_name": "Mike",
 *   "last_name": "Johnson",
 *   "phone": "0412345678",
 *   "dob": "1995-06-15",
 *   "bank_details": "BSB: 062000, Acc: 12345678",
 *   "emergency_contact_name": "Sarah Johnson",
 *   "emergency_contact_phone": "0498765432",
 *   "employment_type": "full_time",
 *   "role_title": "Barista",
 *   "pay_cycle": "fortnightly",
 *   "kiosk_pin": "1234",
 *   "start_date": "2026-03-01",
 *   "employee_id": "EMP001",
 *   "weekday_rate": 28.50,
 *   "opening_balances": { "LT_ID": 10.5 } (optional)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', "manager");
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const body = await request.json();

        // Validate required employee fields
        const validationError = validateRequiredFields(body, [
            'email',
            'password',
            'first_name',
            'last_name',
            'dob',
            'emergency_contact_name',
            'emergency_contact_phone',
            'role_title',
            'kiosk_pin',
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
            bank_account_name,
            bank_bsb,
            bank_account_number,
            "ABN/TFN/ACN": abn_tfn_acn,
            emergency_contact_name,
            emergency_contact_phone,
            employment_type,
            role_title,
            pay_cycle,
            kiosk_pin,
            start_date,
            end_date,
            employee_id,
            // Rate fields
            weekday_rate,
            saturday_multiplier = 1.25,
            sunday_multiplier = 1.50,
            public_holiday_multiplier = 2.50,
            evening_rate,
            evening_start_time,
            evening_end_time,
            opening_balances, // Optional: { [leave_type_id]: hours }
        } = body;

        if (password.length < 6) {
            return errorResponse('Password must be at least 6 characters', 400);
        }

        // Step 1: Create auth user via admin API
        const adminClient = createAdminClient();

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

        // Step 2: Create Employee record
        const hashedPin = await bcrypt.hash(kiosk_pin, 10);

        const { data: employeeData, error: employeeError } = await supabase
            .from('Employee')
            .insert({
                employee_id,
                first_name,
                last_name,
                phone: phone || null,
                email,
                dob,
                bank_details: bank_details || "",
                bank_account_name: bank_account_name || null,
                bank_bsb: bank_bsb || null,
                bank_account_number: bank_account_number || null,
                "ABN/TFN/ACN": abn_tfn_acn || null,
                emergency_contact_name,
                emergency_contact_phone,
                employment_type: employment_type || null,
                role_title,
                pay_cycle: pay_cycle || null,
                kiosk_pin: hashedPin,
                start_date,
                end_date: end_date || null,
                business_id: authUser.business_id,
                user_id: authData.user.id,
                status: 'active',
            })
            .select()
            .single();

        if (employeeError) {
            // Cleanup: delete auth user if employee creation fails
            await adminClient.auth.admin.deleteUser(authData.user.id);
            return errorResponse(`Failed to create employee: ${employeeError.message}`, 400);
        }

        // Step 3: Create initial EmployeeRateHistory
        const { data: rateData, error: rateError } = await supabase
            .from('EmployeeRateHistory')
            .insert({
                employee_id,
                business_id: authUser.business_id,
                weekday_rate,
                saturday_multiplier,
                sunday_multiplier,
                public_holiday_multiplier,
                evening_rate: evening_rate || null,
                evening_start_time: evening_start_time || null,
                evening_end_time: evening_end_time || null,
                effective_from: start_date,
                created_bv: authUser.user_id,
            })
            .select()
            .single();

        if (rateError) {
            console.error('Rate history creation failed:', rateError.message);
            // Don't fail the whole request — employee is created, rate can be added later
        }

        // Step 4: Initialize Leave Balances for all active leave types
        const { data: leaveTypes } = await supabase
            .from('LeaveType')
            .select('leave_type_id')
            .eq('business_id', authUser.business_id);

        if (leaveTypes && leaveTypes.length > 0) {
            const currentYear = new Date().getFullYear();
            const balanceData = leaveTypes.map(lt => ({
                employee_id: employee_id,
                leave_type_id: lt.leave_type_id,
                business_id: authUser.business_id,
                accrued_hours: opening_balances?.[lt.leave_type_id] || 0,
                taken_hours: 0,
                pending_hours: 0,
                year: currentYear,
                updated_at: new Date().toISOString()
            }));

            const { error: balanceErr } = await supabase.from('LeaveBalance').insert(balanceData);
            if (balanceErr) console.error('Leave balance initialization failed:', balanceErr.message);
        }

        await logAudit({
            businessId: authUser.business_id,
            tableName: 'Employee',
            recordId: employeeData.employee_id,
            action: 'INSERT',
            changedBy: authUser.user_id,
            afterValue: employeeData,
            reason: 'Created new employee'
        });

        return successResponse(
            {
                employee: employeeData,
                rate_history: rateData || null,
            },
            'Employee created successfully',
            201
        );
    } catch (error) {
        console.error('Create employee error:', error);
        return errorResponse('Internal server error', 500);
    }
}
