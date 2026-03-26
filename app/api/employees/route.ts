import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import { generateBusinessPrefix, formatEmpSuffix, getNumericSuffix } from '@/lib/utils/employee-id';

/**
 * GET /api/employees
 * 
 * List all employees for the business
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager', 'employee');
        if (!authUser) {
            return errorResponse('Unauthorized', 401);
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status');
        const roleFilter = searchParams.get('role');
        const excludeSelf = searchParams.get('exclude_self') === 'true';
        const excludeConflictsForShift = searchParams.get('exclude_conflicts_for_shift');
        const onlyWithShifts = searchParams.get('only_with_shifts') === 'true';

        // Explicitly list ALL columns we need to avoid PostgREST join ambiguity/conflicts
        const columns = [
            'employee_id', 'first_name', 'last_name', 'role_title', 'status', 'business_id', 'user_id',
            'email', 'phone', 'dob', 'employment_type', 'pay_cycle', 'start_date', 'end_date', 'created_at',
            'abn', 'tfn', 'bank_account_name', 'bank_bsb', 'bank_account_number'
        ];
        
        // Build the select string
        let selectFields = columns.join(', ');

        let query = supabase
            .from('Employee')
            .select(selectFields)
            .eq('business_id', authUser.business_id);

        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        if (roleFilter) {
            // Role filtering happens later in memory due to join complexity
        }

        // Available for Swap - Conflict Exclusion
        if (excludeConflictsForShift) {
            const { data: targetShift } = await supabase
                .from('Shift')
                .select('start_time, end_time')
                .eq('shift_id', excludeConflictsForShift)
                .single();

            if (targetShift) {
                const { data: overlappingShifts } = await supabase
                    .from('Shift')
                    .select('employee_id')
                    .eq('business_id', authUser.business_id)
                    .lt('start_time', targetShift.end_time)
                    .gt('end_time', targetShift.start_time);

                const busyIds = (overlappingShifts || [])
                    .map(s => s.employee_id)
                    .filter(id => id !== null);

                if (busyIds.length > 0) {
                    // Exclude busy employees
                    query = query.not('employee_id', 'in', `(${busyIds.join(',')})`);
                }
            }
        }

        // Filter for employees who HAVE upcoming shifts (for Swap)
        if (onlyWithShifts) {
            const now = new Date().toISOString();
            const { data: employeesWithShifts } = await supabase
                .from('Shift')
                .select('employee_id')
                .eq('business_id', authUser.business_id)
                .gt('start_time', now);
            
            const eligibleIds = Array.from(new Set((employeesWithShifts || []).map(s => s.employee_id).filter(Boolean)));
            
            if (eligibleIds.length > 0) {
                query = query.in('employee_id', eligibleIds);
            } else {
                // Return empty if no one has shifts
                return successResponse([], 'No employees with upcoming shifts found');
            }
        }

        const { data: employees, error } = await query.order('first_name', { ascending: true });

        if (error) {
            console.error('Employees API Query Error:', error);
            return errorResponse(error.message, 400);
        }

        const employeesRaw: any[] = employees || [];
        let filtered = [...employeesRaw];

        // Fetch user roles for all found employees
        if (filtered.length > 0) {
            const { data: userRoles } = await supabase
                .from('User')
                .select('user_id, role')
                .in('user_id', filtered.map(e => e.user_id).filter(Boolean));
            
            const roleMap = new Map((userRoles || []).map(u => [u.user_id, u.role]));
            
            filtered = filtered.map((emp: any) => ({
                ...emp,
                role: roleMap.get(emp.user_id) || 'employee'
            }));

            // If roleFilter was provided, apply it now
            if (roleFilter) {
                filtered = filtered.filter((emp: any) => emp.role === roleFilter);
            }
        }

        if (excludeSelf) {
            filtered = filtered.filter((e: any) => e.user_id !== authUser.user_id);
        }

        return successResponse(filtered, `Found ${filtered.length} employee(s)`);
    } catch (error) {
        console.error('List employees error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/employees
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
            'start_date',
            'employee_id',
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
            bank_account_name,
            bank_bsb,
            bank_account_number,
            abn,
            tfn,
            emergency_contact_name,
            emergency_contact_phone,
            employment_type,
            role_title,
            pay_cycle,
            start_date,
            end_date,
            employee_id,
            invite_as = 'employee',
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

        const supabase = await createClient();
        let finalEmployeeId = employee_id;

        // Ensure employee_id follows the business-prefixed format (e.g. BVL0001)
        // If it starts with "EMP-" or doesn't match the new format, we regenerate it.
        const isOldFormat = employee_id.startsWith('EMP-') || !/^[A-Z]{3}\d{4}$/.test(employee_id);
        
        if (isOldFormat) {
            const { data: business } = await supabase
                .from('Business')
                .select('business_name')
                .eq('business_id', authUser.business_id)
                .single();

            const businessPrefix = business?.business_name ? generateBusinessPrefix(business.business_name) : 'EMP';
            
            const { data: allEmps } = await supabase
                .from('Employee')
                .select('employee_id')
                .eq('business_id', authUser.business_id);

            let maxSerial = 0;
            for (const e of allEmps || []) {
                const serial = getNumericSuffix(e.employee_id);
                if (serial > maxSerial) maxSerial = serial;
            }
            finalEmployeeId = `${businessPrefix}${formatEmpSuffix(maxSerial + 1)}`;
        }

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

        const { data: employeeData, error: employeeError } = await supabase
            .from('Employee')
            .insert({
                employee_id: finalEmployeeId,
                first_name,
                last_name,
                phone: phone || null,
                email,
                dob: dob || null,
                bank_account_name: bank_account_name || null,
                bank_bsb: bank_bsb || null,
                bank_account_number: bank_account_number || null,
                abn: abn || null,
                tfn: tfn || null,
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
            })
            .select()
            .single();

        if (employeeError) {
            // Cleanup: delete auth user if employee creation fails
            await adminClient.auth.admin.deleteUser(authData.user.id);
            return errorResponse(`Failed to create employee: ${employeeError.message}`, 400);
        }

        // Step 3: Create initial EmployeeRateHistory (if rate provided)
        let rateData: any = null;
        if (weekday_rate !== undefined && weekday_rate !== null && String(weekday_rate).trim() !== '') {
            const { data, error: rateError } = await supabase
                .from('EmployeeRateHistory')
                .insert({
                    employee_id: employeeData.employee_id,
                    business_id: authUser.business_id,
                    weekday_rate: parseFloat(String(weekday_rate)),
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
            } else {
                rateData = data;
            }
        }

        // Step 3.5: If manager, create User record
        if (invite_as === 'manager') {
            const { error: userError } = await supabase.from('User').insert({
                user_id: authData.user.id,
                business_id: authUser.business_id,
                role: 'manager',
                first_name,
                last_name,
            });
            if (userError) console.error('Manager User record creation failed:', userError.message);
        }

        // Step 4: Initialize Leave Balances
        const { data: leaveTypes } = await supabase
            .from('LeaveType')
            .select('leave_type_id')
            .eq('business_id', authUser.business_id);

        if (leaveTypes && leaveTypes.length > 0) {
            const currentYear = new Date().getFullYear();
            const balanceData = leaveTypes.map(lt => ({
                employee_id: finalEmployeeId,
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
