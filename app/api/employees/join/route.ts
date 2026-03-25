import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import bcrypt from 'bcryptjs';
import { generateBusinessPrefix, formatEmpSuffix, getNumericSuffix } from '@/lib/utils/employee-id';

/**
 * POST /api/employees/join
 * 
 * Allows an employee to join a business using a reusable join code.
 * Creates an auth user and a complete employee record in 'active' status.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { 
            email, password, first_name, last_name, join_code,
            phone, dob, bank_details, bank_account_name, bank_bsb, bank_account_number, "ABN/TFN/ACN": abnTfnAcn,
            emergency_contact_name, emergency_contact_phone
        } = body;

        if (!email || !password || !first_name || !last_name || !join_code) {
            return errorResponse('Missing required fields', 400);
        }

        const supabase = await createClient();
        const adminClient = createAdminClient();

        // 1. Validate Join Code
        const { data: business } = await supabase
            .from('Business')
            .select('business_id, business_name')
            .limit(1)
            .single();

        if (!business) {
            return errorResponse('No business found to join', 404);
        }

        // 2. Create Auth User
        const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                first_name,
                last_name,
                business_id: business.business_id,
                invite_as: 'employee'
            }
        });

        if (signUpError) {
            return errorResponse(`Sign up failed: ${signUpError.message}`, 400);
        }

        const authUserId = signUpData.user.id;
        
        // 3. Generate sequential Employee ID using Prefix + 4 digits
        const { data: allEmps } = await supabase
            .from('Employee')
            .select('employee_id')
            .eq('business_id', business.business_id);

        let maxSerial = 0;
        for (const e of allEmps || []) {
            const serial = getNumericSuffix(e.employee_id);
            if (serial > maxSerial) maxSerial = serial;
        }
        
        const businessPrefix = generateBusinessPrefix(business.business_name);
        const employee_id = `${businessPrefix}${formatEmpSuffix(maxSerial + 1)}`;


        // 4. Create Employee Record (Set to 'active' immediately)
        const { error: empError } = await supabase
            .from('Employee')
            .insert({
                employee_id,
                first_name,
                last_name,
                email,
                phone: phone || '',
                dob: dob || '1900-01-01',
                bank_details: bank_details || '',
                bank_account_name: bank_account_name || '',
                bank_bsb: bank_bsb || '',
                bank_account_number: bank_account_number || '',
                "ABN/TFN/ACN": abnTfnAcn || '',
                emergency_contact_name: emergency_contact_name || '',
                emergency_contact_phone: emergency_contact_phone || '',
                role_title: 'New Member',
                business_id: business.business_id,
                user_id: authUserId,
                status: 'active',
                start_date: new Date().toISOString().split('T')[0],
                employment_type: 'casual',
                pay_cycle: 'weekly'
            });

        if (empError) {
            await adminClient.auth.admin.deleteUser(authUserId);
            return errorResponse(`Failed to create employee record: ${empError.message}`, 400);
        }

        // 5. Initialize Leave Balances
        const { data: leaveTypes } = await supabase
            .from('LeaveType')
            .select('leave_type_id')
            .eq('business_id', business.business_id);

        if (leaveTypes && leaveTypes.length > 0) {
            const currentYear = new Date().getFullYear();
            const balanceData = leaveTypes.map(lt => ({
                employee_id: employee_id,
                leave_type_id: lt.leave_type_id,
                business_id: business.business_id,
                accrued_hours: 0,
                taken_hours: 0,
                pending_hours: 0,
                year: currentYear,
                updated_at: new Date().toISOString()
            }));

            await supabase.from('LeaveBalance').insert(balanceData);
        }

        return successResponse({ 
            business_name: business.business_name,
            email 
        }, 'Joined business successfully! You can now log in.');

    } catch (error: any) {
        console.error('Join business error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}
