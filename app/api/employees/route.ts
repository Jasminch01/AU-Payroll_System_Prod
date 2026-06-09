import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';
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
        
        // Paging Parameters
        const isPaginated = searchParams.get('paginate') === 'true';
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        
        // Sorting and Searching
        const search = searchParams.get('search') || '';
        const sortBy = searchParams.get('sortBy') || 'first_name';
        const sortDir = searchParams.get('sortDir') || 'asc';
        
        // Filters
        const statusFilter = searchParams.get('status');
        const roleFilter = searchParams.get('role');
        const excludeSelf = searchParams.get('exclude_self') === 'true';
        const excludeConflictsForShift = searchParams.get('exclude_conflicts_for_shift');
        const onlyWithShifts = searchParams.get('only_with_shifts') === 'true';



        // Calculate offset
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Explicitly list ALL columns we need to avoid PostgREST join ambiguity/conflicts
        const columns = [
            'employee_id', 'first_name', 'last_name', 'role_title', 'role', 'status', 'business_id', 'user_id',
            'email', 'phone', 'dob', 'employment_type', 'pay_cycle', 'start_date', 'end_date', 'created_at',
            'abn', 'tfn', 'bank_account_name', 'bank_bsb', 'bank_account_number'
        ];

        // Build the select string
        let selectFields = columns.join(', ');

        let query = supabase
            .from('Employee')
            .select(selectFields, isPaginated ? { count: 'exact' } : undefined)
            .eq('business_id', authUser.business_id);
        
        // Force 'active' status for Swap/Transfer/Pool related colleague lookups
        if (excludeConflictsForShift || onlyWithShifts) {
            query = query.eq('status', 'active');
        }

        if (statusFilter && statusFilter !== 'all') {
            if (statusFilter.includes(',')) {
                query = query.in('status', statusFilter.split(','));
            } else {
                query = query.eq('status', statusFilter);
            }
        }

        if (search) {
            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,role_title.ilike.%${search}%`);
        }

        if (roleFilter) {
            // Role filtering happens later in memory due to join complexity
        }

        // Pre-compute IDs for in-memory filtering (avoids PostgREST 'not.in' issues with custom string IDs)
        let busyEmployeeIds = new Set<string>();
        let eligibleEmployeeIds: string[] | null = null;

        // Available for Swap - Conflict Exclusion (collect IDs, filter in-memory later)
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

                (overlappingShifts || []).forEach(s => {
                    if (s.employee_id) busyEmployeeIds.add(s.employee_id);
                });


            }
        }

        // Filter for employees who HAVE upcoming/available shifts (for Swap)
        if (onlyWithShifts) {
            // Only count PUBLISHED upcoming shifts (ensures colleague actually has a visible swappable shift)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const now = todayStart.toISOString();

            const { data: employeesWithShifts } = await supabase
                .from('Shift')
                .select('employee_id')
                .eq('business_id', authUser.business_id)
                .eq('shift_status', 'published')
                .gt('start_time', now);

            // Filter out the requester themselves
            const requesterEmpId = authUser.employee_id;
            eligibleEmployeeIds = Array.from(new Set(
                (employeesWithShifts || [])
                    .map(s => s.employee_id)
                    .filter((id): id is string => !!id && id !== requesterEmpId)
            ));

            if (eligibleEmployeeIds.length === 0) {

                // Return empty if no one else has published shifts
                return successResponse([], 'No colleagues with available shifts found');
            }

        }

        // First determine eligible employees if onlyWithShifts or excludeConflictsForShift
        // Only run these complex in-memory filters if needed
        let doInMemoryFilter = busyEmployeeIds.size > 0 || eligibleEmployeeIds !== null || excludeSelf;

        if (doInMemoryFilter) {
            // Apply IDs directly inside the DB query if it's less than thousands of IDs (safest fallback)
            // But PostgREST has a limit on 'in' / 'not.in' array size.
            // If we have to do memory filtering, we might need all employees.
            // For now, let's inject valid IDs if possible
            if (eligibleEmployeeIds !== null) {
                query = query.in('employee_id', eligibleEmployeeIds);
            }
        }

        // Apply sorting and pagination
        const validSortFields = ['first_name', 'last_name', 'start_date', 'status', 'role_title', 'email', 'employment_type'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'first_name';
        
        query = query.order(safeSortBy, { ascending: sortDir === 'asc' });

        // Only paginate if not applying dynamic in-memory exclude list (which requires all available before slice)
        // Note: exclude_self can safely just exclude the requester by DB query.
        if (excludeSelf) {
            query = query.neq('user_id', authUser.user_id);
        }

        if (busyEmployeeIds.size > 0) {
           // For Swaps (onlyWithShifts), we allow 'busy' employees to show up 
           // because they will be giving up the overlapping shift anyway.
           // We only strictly exclude busy employees for one-way Transfers.
           if (!onlyWithShifts) {
               query = query.filter('employee_id', 'not.in', `(${Array.from(busyEmployeeIds).join(',')})`);
           }
        }

        // Apply server pagination only if requested
        if (isPaginated) {
            query = query.range(from, to);
        }

        // Execute main queries in parallel
        const [queryResult, allStatusesResult] = await Promise.all([
            query,
            supabase.from('Employee').select('status, role, user_id').eq('business_id', authUser.business_id)
        ]);

        const { data: employees, error, count } = queryResult;
        const { data: allStatuses } = allStatusesResult;

        if (error) {
            console.error('[Employees API] Query Error:', error);
            return errorResponse(error.message, 400);
        }

        let filtered = employees || [];

        // Collect all user IDs needed for role resolution
        const allValidUserIds = Array.from(new Set([
            ...filtered.map((e: any) => e.user_id),
            ...(allStatuses || []).map(e => e.user_id)
        ])).filter(Boolean);

        let globalRoleMap = new Map();
        if (allValidUserIds.length > 0) {
            const { data: allUserRoles } = await supabase
                .from('User')
                .select('user_id, role')
                .in('user_id', allValidUserIds as string[]);
            globalRoleMap = new Map((allUserRoles || []).map(u => [u.user_id, u.role]));
        }

        // Apply roles and re-filter
        if (filtered.length > 0) {
            filtered = filtered.map((emp: any) => ({
                ...emp,
                role: globalRoleMap.get(emp.user_id) || emp.role || 'employee'
            }));

            // Re-apply roleFilter since we compute standard roles here
            if (roleFilter && roleFilter !== 'all') {
                filtered = filtered.filter((emp: any) => emp.role === roleFilter);
            }
        }

        let activeCount = 0;
        let invitedCount = 0;
        let inactiveCount = 0;
        let managerCount = 0;
        let employeeCount = 0;

        (allStatuses || []).forEach(e => {
            if (e.status === 'active') activeCount++;
            else if (e.status === 'invited') invitedCount++;
            else if (e.status === 'inactive') inactiveCount++;
            
            const actualRole = globalRoleMap.get(e.user_id) || e.role || 'employee';
            if (actualRole === 'manager') managerCount++;
            else employeeCount++;
        });

        const totalItems = count || 0;

        if (isPaginated) {

            return successResponse({
                employees: filtered,
                meta: {
                    total_count: totalItems,
                    page,
                    limit,
                    counts: {
                        all: (allStatuses || []).length,
                        active: activeCount,
                        invited: invitedCount,
                        inactive: inactiveCount,
                        manager: managerCount,
                        employee: employeeCount
                    }
                }
            }, `Found ${filtered.length} employee(s) page`);
        } else {
            if (filtered.length > 0) {

            } else {

            }
            return successResponse(filtered, `Found ${filtered.length} employee(s)`);
        }
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

        let authUserId: string | null = null;

        // Step 1: Create auth user via admin API (only if email/password provided)
        if (email && password) {
            if (password.length < 6) {
                return errorResponse('Password must be at least 6 characters', 400);
            }

            const adminClient = createAdminClient();
            const { data: authData, error: authError } =
                await adminClient.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: {
                        role: 'employee',
                        first_name,
                        last_name,
                        business_id: authUser.business_id
                    }
                });

            if (authError) {
                return errorResponse(`Failed to create auth account: ${authError.message}`, 400);
            }

            if (!authData.user) {
                return errorResponse('Failed to create user account', 500);
            }

            authUserId = authData.user.id;
        }

        const { data: employeeData, error: employeeError } = await supabase
            .from('Employee')
            .insert({
                employee_id: finalEmployeeId,
                first_name,
                last_name,
                phone: phone || null,
                email: email || null,
                dob: null, // Skip for now
                bank_account_name: null, // Skip for now
                bank_bsb: null, // Skip for now
                bank_account_number: null, // Skip for now
                abn: null, // Skip for now
                tfn: null, // Skip for now
                emergency_contact_name,
                emergency_contact_phone,
                employment_type: employment_type || null,
                role_title,
                pay_cycle: null, // Skip for now
                start_date,
                end_date: end_date || null,
                business_id: authUser.business_id,
                user_id: authUserId,
                status: authUserId ? 'active' : 'inactive',
                role: invite_as === 'manager' ? 'manager' : 'employee',
            })
            .select()
            .single();

        if (employeeError) {
            // Cleanup: delete auth user if employee creation fails
            if (authUserId) {
                const adminClient = createAdminClient();
                await adminClient.auth.admin.deleteUser(authUserId);
            }
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

        // Step 3.5: If manager and has auth user, create User record
        if (authUserId && invite_as === 'manager') {
            const { error: userError } = await supabase.from('User').insert({
                user_id: authUserId,
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
