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
            invite_as = 'employee',
        } = body;

        // Only owners can invite managers
        if (invite_as === 'manager' && authUser.role !== 'owner') {
            return errorResponse('Only owners can invite managers', 403);
        }

        const adminClient = createAdminClient();
        // FIX: createClient() returns a promise — await it once and reuse
        const supabase = await createClient();

        // 1. Check if employee already exists in this business
        const { data: existingEmployee } = await supabase
            .from('Employee')
            .select('employee_id')
            .eq('email', email)
            .eq('business_id', authUser.business_id)
            .maybeSingle();

        if (existingEmployee) {
            return errorResponse('An employee with this email already exists in your business', 409);
        }

        let authUserId = '';
        let inviteSent = false;
        let actionLink: string | null = null;
        // FIX: track whether the auth user already existed before this request
        let isExistingUser = false;

        // 2. Try officially inviting (sends email and creates auth user if they don't exist)
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
            data: {
                first_name,
                last_name,
                business_id: authUser.business_id,
                invite_as,
                invited_by: authUser.user_id,
            },
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/onboarding`,
        });

        if (inviteError) {
            if (
                inviteError.message.toLowerCase().includes('already been registered') ||
                inviteError.status === 422
            ) {
                // Auth user already exists — look them up
                isExistingUser = true;
                const { data: { users } } = await adminClient.auth.admin.listUsers();
                const found = users.find(u => u.email === email);
                if (!found) {
                    return errorResponse('User already exists but could not find their auth record.', 400);
                }
                authUserId = found.id;

            } else if (inviteError.message.includes('Error sending invite email')) {
                // SMTP failure — create the auth user manually so we can still generate a link
                console.error('SUPABASE SMTP ERROR:', inviteError);

                const tempPassword = crypto.randomUUID() + 'Aa1!';
                const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
                    email,
                    password: tempPassword,
                    email_confirm: true,
                    user_metadata: {
                        first_name,
                        last_name,
                        business_id: authUser.business_id,
                        invite_as,
                        invited_by: authUser.user_id,
                    },
                });

                if (createError) {
                    if (createError.message.toLowerCase().includes('already been registered')) {
                        // Race condition — user was created between our check and now
                        isExistingUser = true;
                        const { data: { users } } = await adminClient.auth.admin.listUsers();
                        const found = users.find(u => u.email === email);
                        if (!found) {
                            // FIX: was silently setting authUserId to '' — now we hard-fail
                            return errorResponse('User already exists but could not find their auth record.', 400);
                        }
                        authUserId = found.id;
                    } else {
                        return errorResponse(`Failed to create auth user: ${createError.message}`, 400);
                    }
                } else {
                    authUserId = createData.user.id;
                }
            } else {
                return errorResponse(`Invitation failed: ${inviteError.message}`, 400);
            }
        } else {
            authUserId = inviteData.user.id;
            inviteSent = true;
        }

        // 3. Generate a shareable link for manual delivery (essential when email fails)
        // FIX: always use 'magiclink' for existing users — 'invite' tokens are one-time and
        //      will have already been consumed if the user was created in a previous attempt.
        const linkType = isExistingUser ? 'magiclink' : 'invite';
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: linkType,
            email,
            options: {
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/onboarding`,
            },
        });

        if (linkError) {
            // Non-fatal — we still proceed; the admin just won't have a copyable link
            console.error('generateLink error:', linkError);
        } else if (linkData?.properties?.action_link) {
            actionLink = linkData.properties.action_link;
        }

        // 4. Generate a unique employee_id
        const employee_id = `EMP-${Date.now().toString(36).toUpperCase()}`;

        // 5. Create the Employee record with 'invited' status
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
                user_id: authUserId,
                status: 'invited',
                start_date: new Date().toISOString().split('T')[0],
                // Placeholder values — employee will replace these during onboarding
                dob: '1900-01-01',
                bank_details: '',
                emergency_contact_name: '',
                emergency_contact_phone: '',
                kiosk_pin: '',
            })
            .select()
            .single();

        if (empError) {
            // Rollback: remove the auth user only if we freshly created them here
            if (!isExistingUser && authUserId) {
                await adminClient.auth.admin.deleteUser(authUserId);
            }
            return errorResponse(`Failed to create employee record: ${empError.message}`, 400);
        }

        // 6. Create initial pay rate record
        // FIX: typo 'created_bv' → 'created_by'
        const { error: rateError } = await supabase
            .from('EmployeeRateHistory')
            .insert({
                employee_id,
                business_id: authUser.business_id,
                weekday_rate,
                saturday_multiplier,
                sunday_multiplier,
                public_holiday_multiplier,
                effective_from: new Date().toISOString().split('T')[0],
                created_by: authUser.user_id,
            });

        if (rateError) {
            console.error('Failed to insert rate history:', rateError);
            // Non-fatal for the invite flow — log and continue
        }

        // 7. If inviting as manager, create the User record with 'manager' role
        // FIX: moved inside the success path (after employee insert) so it only runs
        //      if the employee record was actually created successfully
        if (invite_as === 'manager') {
            const { error: userRoleError } = await supabase
                .from('User')
                .insert({
                    user_id: authUserId,
                    business_id: authUser.business_id,
                    role: 'manager',
                    first_name,
                    last_name,
                });

            if (userRoleError) {
                console.error('Failed to create manager User record:', userRoleError);
                // Non-fatal — the employee record exists; the manager role can be assigned manually
            }
        }

        // 8. Audit log
        await logAudit({
            businessId: authUser.business_id,
            tableName: 'Employee',
            recordId: employee_id,
            action: 'INSERT',
            changedBy: authUser.user_id,
            afterValue: employeeData,
            reason: `Invited ${invite_as} via email`,
        });

        return successResponse(
            {
                employee: employeeData,
                invite_link: actionLink,
                invite_sent: inviteSent,
            },
            inviteSent
                ? `Invitation email sent to ${email}`
                : `Employee added. ${actionLink ? 'Share the invite link manually.' : 'Could not generate invite link — check Supabase logs.'}`,
            201
        );
    } catch (error: any) {
        console.error('Invite employee error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}