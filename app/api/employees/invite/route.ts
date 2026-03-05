import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/employees/invite
 * 
 * Send an invitation to a new employee or manager.
 * Owner/Manager fills in minimal info; the invitee completes self-onboarding.
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "email": "newemployee@example.com",
 *   "first_name": "Jane",
 *   "last_name": "Doe",
 *   "role_title": "Barista",
 *   "employment_type": "casual",          // optional
 *   "weekday_rate": 28.50,
 *   "invite_as": "employee" | "manager"   // defaults to "employee"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) {
            return errorResponse('Unauthorized', 401);
        }

        const body = await request.json();

        const validationError = validateRequiredFields(body, [
            'email',
            'first_name',
            'last_name',
            'role_title',
            'weekday_rate',
        ]);
        if (validationError) return errorResponse(validationError, 400);

        const {
            email,
            first_name,
            last_name,
            role_title,
            employment_type,
            weekday_rate,
            saturday_multiplier = 1.25,
            sunday_multiplier = 1.50,
            public_holiday_multiplier = 2.50,
            invite_as = 'employee'
        } = body;

        // Only owners can invite managers
        if (invite_as === 'manager' && authUser.role !== 'owner') {
            return errorResponse('Only owners can invite managers', 403);
        }

        const adminClient = createAdminClient();

        // 1. Check if user already exists
        const { data: existingEmployee } = await (await createClient())
            .from('Employee')
            .select('employee_id')
            .eq('email', email)
            .eq('business_id', authUser.business_id)
            .maybeSingle();

        if (existingEmployee) {
            return errorResponse('An employee with this email already exists in your business', 409);
        }

        // 2. Create auth user with a random temporary password (invitee will set their own)
        const tempPassword = crypto.randomUUID() + 'Aa1!'; // Satisfies most password policies
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: false, // They'll confirm via invite email
            user_metadata: {
                first_name,
                last_name,
                business_id: authUser.business_id,
                invite_as,
                invited_by: authUser.user_id,
            }
        });

        if (authError) {
            return errorResponse(`Failed to create invite: ${authError.message}`, 400);
        }

        // 3. Generate an employee_id
        const employee_id = `EMP-${Date.now().toString(36).toUpperCase()}`;

        // 4. Create an Employee record with 'invited' status (minimal data)
        const supabase = await createClient();
        const { data: employeeData, error: empError } = await supabase
            .from('Employee')
            .insert({
                employee_id,
                first_name,
                last_name,
                email,
                role_title,
                employment_type: employment_type || null,
                business_id: authUser.business_id,
                user_id: authData.user.id,
                status: 'invited',
                start_date: new Date().toISOString().split('T')[0],
                // Placeholder values — employee will fill these in during onboarding
                dob: '1900-01-01',
                bank_details: '',
                emergency_contact_name: '',
                emergency_contact_phone: '',
                kiosk_pin: '',
            })
            .select()
            .single();

        if (empError) {
            // Cleanup: remove auth user if employee creation fails
            await adminClient.auth.admin.deleteUser(authData.user.id);
            return errorResponse(`Failed to create employee record: ${empError.message}`, 400);
        }

        // 5. Create initial pay rate record
        await supabase
            .from('EmployeeRateHistory')
            .insert({
                employee_id,
                business_id: authUser.business_id,
                weekday_rate,
                saturday_multiplier,
                sunday_multiplier,
                public_holiday_multiplier,
                effective_from: new Date().toISOString().split('T')[0],
                created_bv: authUser.user_id,
            });

        // 6. If inviting as manager, create the User record with 'manager' role
        if (invite_as === 'manager') {
            await supabase
                .from('User')
                .insert({
                    user_id: authData.user.id,
                    business_id: authUser.business_id,
                    role: 'manager',
                    first_name,
                    last_name,
                });
        }

        // 7. Send the actual invitation email via Supabase
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: 'invite',
            email,
            options: {
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/onboarding`,
            }
        });

        if (linkError) {
            console.error('Failed to generate invite link:', linkError);
            // Employee is created, just the email didn't send. Not a hard failure.
        }

        // 8. Audit log
        await logAudit({
            businessId: authUser.business_id,
            tableName: 'Employee',
            recordId: employee_id,
            action: 'INSERT',
            changedBy: authUser.user_id,
            afterValue: employeeData,
            reason: `Invited ${invite_as} via email`
        });

        return successResponse({
            employee: employeeData,
            invite_link: linkData?.properties?.action_link || null,
            invite_sent: !linkError,
        }, `Invitation sent to ${email}`, 201);
    } catch (error: any) {
        console.error('Invite employee error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}
