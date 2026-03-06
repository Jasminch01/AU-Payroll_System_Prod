import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';

/**
 * POST /api/onboarding/complete
 * 
 * Complete the self-onboarding process after accepting an invitation.
 * The user must be authenticated (via the invite magic link which auto-signs them in).
 * Access: Authenticated user with 'invited' employee status
 * 
 * Body:
 * {
 *   "password": "newsecurepassword",
 *   "phone": "0412345678",
 *   "dob": "1995-06-15",
 *   "bank_details": "BSB: 062000, Acc: 12345678",
 *   "emergency_contact_name": "Sarah Johnson",
 *   "emergency_contact_phone": "0498765432",
 *   "kiosk_pin": "1234"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Get the currently authenticated user (signed in via invite link)
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return errorResponse('Not authenticated. Please use the invitation link from your email.', 401);
        }

        const body = await request.json();
        const validationError = validateRequiredFields(body, [
            'password',
            'phone',
            'dob',
            'bank_details',
            'emergency_contact_name',
            'emergency_contact_phone',
            'kiosk_pin',
        ]);
        if (validationError) return errorResponse(validationError, 400);

        const {
            password,
            phone,
            dob,
            bank_details,
            emergency_contact_name,
            emergency_contact_phone,
            kiosk_pin,
        } = body;

        if (password.length < 6) {
            return errorResponse('Password must be at least 6 characters', 400);
        }

        if (!/^\d{4}$/.test(kiosk_pin)) {
            return errorResponse('Kiosk PIN must be exactly 4 digits', 400);
        }

        // 2. Find the employee record linked to this auth user
        const { data: employee, error: empError } = await supabase
            .from('Employee')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (empError || !employee) {
            return errorResponse('No pending invitation found for this account', 404);
        }

        if (employee.status !== 'invited') {
            return errorResponse('This account has already been onboarded', 400);
        }

        // 3. Update the user's password (replace the temp one)
        const adminClient = createAdminClient();
        const { error: passwordError } = await adminClient.auth.admin.updateUserById(user.id, {
            password,
            email_confirm: true, // Mark email as confirmed now
        });

        if (passwordError) {
            return errorResponse(`Failed to set password: ${passwordError.message}`, 500);
        }

        // 4. Hash the kiosk PIN
        const hashedPin = await bcrypt.hash(kiosk_pin, 10);

        // 5. Update the Employee record with self-service data
        const { data: updatedEmployee, error: updateError } = await supabase
            .from('Employee')
            .update({
                phone,
                dob,
                bank_details,
                emergency_contact_name,
                emergency_contact_phone,
                kiosk_pin: hashedPin,
                status: 'active',
                updated_at: new Date().toISOString(),
            })
            .eq('employee_id', employee.employee_id)
            .select()
            .single();

        if (updateError) {
            return errorResponse(`Failed to complete onboarding: ${updateError.message}`, 500);
        }

        // 6. If user doesn't already have a User record (employee role), create one
        const { data: existingUser } = await supabase
            .from('User')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!existingUser) {
            // This is a regular employee (not a manager — managers get their User record at invite time)
            // Employees don't need a User record since they use the Employee table directly
            // But if your auth system requires it, uncomment below:
            // await supabase.from('User').insert({
            //     user_id: user.id,
            //     business_id: employee.business_id,
            //     role: 'employee', // Would need to add 'employee' to UserRole type
            //     first_name: employee.first_name,
            //     last_name: employee.last_name,
            // });
        }

        // 7. Initialize Leave Balances
        const { data: leaveTypes } = await supabase
            .from('LeaveType')
            .select('leave_type_id')
            .eq('business_id', employee.business_id);

        if (leaveTypes && leaveTypes.length > 0) {
            const currentYear = new Date().getFullYear();
            const balanceData = leaveTypes.map(lt => ({
                employee_id: employee.employee_id,
                leave_type_id: lt.leave_type_id,
                business_id: employee.business_id,
                accrued_hours: 0,
                taken_hours: 0,
                pending_hours: 0,
                year: currentYear,
                updated_at: new Date().toISOString()
            }));

            await supabase.from('LeaveBalance').insert(balanceData);
        }

        // 8. Audit log
        await logAudit({
            businessId: employee.business_id,
            tableName: 'Employee',
            recordId: employee.employee_id,
            action: 'UPDATE',
            changedBy: user.id,
            beforeValue: employee,
            afterValue: updatedEmployee,
            reason: 'Employee completed self-onboarding'
        });

        return successResponse(updatedEmployee, 'Onboarding completed successfully! Welcome aboard.');
    } catch (error: any) {
        console.error('Onboarding error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}
