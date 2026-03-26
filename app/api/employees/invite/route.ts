import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';
import { generateBusinessPrefix, formatEmpSuffix, getNumericSuffix } from '@/lib/utils/employee-id';
import { getSiteUrl } from '@/lib/utils/url';

interface InviteResult {
    email: string;
    success: boolean;
    error?: string;
    employee_id?: string;
    invite_link?: string | null;
}

/**
 * POST /api/employees/invite
 *
 * Send an invitation to a new employee or manager.
 * Owner/Manager fills in minimal info; the invitee completes self-onboarding.
 * Access: Owner, Manager
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) {
            return errorResponse('Unauthorized', 401);
        }

        const body = await request.json();

        // 1. Support for recurring Join Code generation
        if (body.action === 'generate_join_code') {
            const supabase = await createClient();
            const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
            
            // For now, let's just return a code that the owner can share. 
            // Real implementation would save this to the DB.
            return successResponse({ join_code: joinCode }, 'Business join code generated');
        }

        // 2. Handle Bulk vs Single Invite
        const employeesToInvite = Array.isArray(body.employees) ? body.employees : [body];

        const results: InviteResult[] = [];
        const adminClient = createAdminClient();
        const supabase = await createClient();

        // 3. Fetch Business Name for Prefix
        const { data: business } = await supabase
            .from('Business')
            .select('business_name')
            .eq('business_id', authUser.business_id)
            .single();

        const businessPrefix = business?.business_name ? generateBusinessPrefix(business.business_name) : 'EMP';

        for (const emp of employeesToInvite) {
            const validationError = validateRequiredFields(emp, ['email', 'first_name', 'last_name']);
            if (validationError) {
                results.push({ email: emp.email, success: false, error: validationError });
                continue;
            }

            const {
                email,
                first_name,
                last_name,
                role_title,
                phone,
                employment_type,
                weekday_rate,
                saturday_multiplier = 1.25,
                sunday_multiplier = 1.50,
                public_holiday_multiplier = 2.50,
                invite_as = 'employee',
            } = emp;

            // Only owners can invite managers
            if (invite_as === 'manager' && authUser.role !== 'owner') {
                results.push({ email, success: false, error: 'Only owners can invite managers' });
                continue;
            }

            // Check if employee already exists in this business
            const { data: existingEmployee } = await supabase
                .from('Employee')
                .select('employee_id')
                .eq('email', email)
                .eq('business_id', authUser.business_id)
                .maybeSingle();

            if (existingEmployee) {
                results.push({ email, success: false, error: 'Employee already exists in this business' });
                continue;
            }

            // Invite via Supabase Auth
            let authUserId = '';
            let isExistingUser = false;
            let actionLink = null;
            const redirectUrl = `${getSiteUrl(request)}/onboarding`;

            const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
                data: { first_name, last_name, business_id: authUser.business_id, invite_as, invited_by: authUser.user_id },
                redirectTo: redirectUrl,
            });

            if (inviteError) {
                console.error(`[invite] inviteUserByEmail failed for ${email}:`, inviteError.status, inviteError.message);
                // Supabase 422 = user already has an auth account (wording can vary)
                const isAlreadyRegistered = inviteError.status === 422 ||
                    inviteError.message.toLowerCase().includes('already') ||
                    inviteError.message.toLowerCase().includes('registered');

                if (isAlreadyRegistered) {
                    isExistingUser = true;
                    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
                    if (listErr) {
                        results.push({ email, success: false, error: `Could not look up existing user: ${listErr.message}` });
                        continue;
                    }
                    const found = users.find(u => u.email === email);
                    if (found) {
                        authUserId = found.id;
                        // Send them a magic link so they know they've been invited
                        await supabase.auth.signInWithOtp({
                            email,
                            options: { emailRedirectTo: redirectUrl }
                        });
                    } else {
                        results.push({ email, success: false, error: 'User not found in auth system after 422 error' });
                        continue;
                    }
                } else {
                    results.push({ email, success: false, error: `Auth invite failed: ${inviteError.message}` });
                    continue;
                }
            } else {
                authUserId = inviteData.user.id;
            }

            // Guard: ensure we have a valid auth user ID before inserting DB record
            if (!authUserId) {
                results.push({ email, success: false, error: 'Could not resolve auth user ID' });
                continue;
            }

            // Note: We avoid calling generateLink here if inviteUserByEmail or signInWithOtp 
            // already sent an email, because generating a second link invalidates the first.
            // If the owner needs a manual link, they can use the "Resend" feature which 
            // can provide one if the email fails, or they can use the Join Code.

            // Generate a unique Employee ID using the new format: PREFIX + 4-digit numeric suffix
            const { data: allEmps } = await supabase
                .from('Employee')
                .select('employee_id')
                .eq('business_id', authUser.business_id);

            let maxSerial = 0;
            for (const e of allEmps || []) {
                const serial = getNumericSuffix(e.employee_id);
                if (serial > maxSerial) maxSerial = serial;
            }
            
            // Account for employees already successfully added in this bulk request
            const existingInResults: number = results.filter(r => r.success).length;
            const employee_id = `${businessPrefix}${formatEmpSuffix(maxSerial + 1 + existingInResults)}`;

            const { data: employeeData, error: empError } = await supabase
                .from('Employee')
                .insert({
                    employee_id, first_name, last_name, email, role_title, phone: phone || null,
                    employment_type: employment_type || null, business_id: authUser.business_id,
                    user_id: authUserId, status: 'invited', start_date: new Date().toISOString().split('T')[0],
                    dob: '1900-01-01', bank_details: '', emergency_contact_name: '', emergency_contact_phone: '',
                })
                .select().single();

            if (empError) {
                console.error(`[invite] Employee DB insert failed for ${email}:`, empError.code, empError.message, empError.details);
                results.push({ email, success: false, error: `DB record failed: ${empError.message}` });
                continue;
            }

            if (weekday_rate) {
                await supabase.from('EmployeeRateHistory').insert({
                    employee_id, business_id: authUser.business_id, weekday_rate,
                    saturday_multiplier, sunday_multiplier, public_holiday_multiplier,
                    effective_from: new Date().toISOString().split('T')[0],
                    created_bv: authUser.user_id,
                });
            }

            if (invite_as === 'manager') {
                await supabase.from('User').insert({
                    user_id: authUserId, business_id: authUser.business_id,
                    role: 'manager', first_name, last_name,
                });
            }

            results.push({ email, success: true, employee_id, invite_link: actionLink });
        }

        const successCount = results.filter(r => r.success).length;
        return successResponse(
            { results, success_count: successCount },
            `Processed ${results.length} invitations. ${successCount} successful.`
        );

    } catch (error: any) {
        console.error('Invite employee error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}