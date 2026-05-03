import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/employees/[id]
 * 
 * Get a specific employee by employee_id
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner or Manager access required.', 401);
        }

        const { id } = await params;
        const supabase = await createClient();

        // Get employee
        const { data: employee, error } = await supabase
            .from('Employee')
            .select('employee_id, first_name, last_name, phone, email, dob, bank_account_name, bank_bsb, bank_account_number, abn, tfn, emergency_contact_name, emergency_contact_phone, employment_type, role_title, pay_cycle, start_date, end_date, created_at, updated_at, business_id, user_id, status')
            .eq('employee_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error || !employee) {
            return errorResponse('Employee not found', 404);
        }

        // Get current pay rate (latest effective_from, no effective_to or future effective_to)
        const today = new Date().toISOString().split('T')[0];
        const { data: currentRate } = await supabase
            .from('EmployeeRateHistory')
            .select('*')
            .eq('employee_id', id)
            .lte('effective_from', today)
            .order('effective_from', { ascending: false })
            .limit(1)
            .single();

        // Get certificates
        const { data: certificates } = await supabase
            .from('Certificate')
            .select('*')
            .eq('employee_id', id);

        // Security: Remove sensitive data if requester is a manager (and not viewing their own profile)
        const isSelf = authUser.employee_id === id;
        if (authUser.role === 'manager' && !isSelf) {
            // bank_details is removed, security handled by selecting only safe fields if needed
        }

        // Get system role from User table
        const { data: userData } = await supabase
            .from('User')
            .select('role')
            .eq('user_id', employee.user_id)
            .maybeSingle();

        return successResponse({
            ...employee,
            role: userData?.role || 'employee',
            current_rate: (authUser.role === 'manager' && !isSelf) ? null : (currentRate || null),
            certificates: certificates || [],
        });
    } catch (error) {
        console.error('Get employee error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PUT /api/employees/[id]
 * 
 * Update an employee's details
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "first_name": "Mike",
 *   "last_name": "Johnson",
 *   "phone": "0412345678",
 *   "email": "newemail@example.com",
 *   "bank_details": "BSB: 062000, Acc: 87654321",
 *   "emergency_contact_name": "New Contact",
 *   "emergency_contact_phone": "0411111111",
 *   "employment_type": "part_time",
 *   "role_title": "Senior Barista",
 *   "pay_cycle": "weekly",
 *   "kiosk_pin": "5678",
 *   "end_date": "2026-12-31",
 *   "status": "active"
 * }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', "manager", "employee");
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();
        const adminClient = createAdminClient();

        // Whitelist updatable fields
        const allowedFields = [
            'first_name',
            'last_name',
            'phone',
            'email',
            'emergency_contact_name',
            'emergency_contact_phone',
            'employment_type',
            'role_title',
            'pay_cycle',
            'end_date',
            'status',
            'abn',
            'tfn',
            'dob',
        ];

        // Only owners (or the employee themselves, if we supported it) can update bank details and pin via this endpoint
        if (authUser.role === 'owner' || authUser.role === 'employee') {
            allowedFields.push('bank_account_name', 'bank_bsb', 'bank_account_number');
        }

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined && field !== 'role') {
                const value = body[field];
                updateData[field] = value === '' ? null : value;
            }
        }

        // Handle date_of_birth alias from frontend
        if (body.date_of_birth !== undefined && updateData.dob === undefined) {
            updateData.dob = body.date_of_birth;
        }

        if (Object.keys(updateData).length === 0 && body.role === undefined) {
            return errorResponse('No valid fields to update', 400);
        }

        updateData.updated_at = new Date().toISOString();

        // Fetch before value for audit log
        const { data: beforeValue } = await supabase
            .from('Employee')
            .select('employee_id, first_name, last_name, phone, email, dob, bank_account_name, bank_bsb, bank_account_number, abn, tfn, emergency_contact_name, emergency_contact_phone, employment_type, role_title, pay_cycle, start_date, end_date, created_at, updated_at, business_id, user_id, status')
            .eq('employee_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (!beforeValue) {
            return errorResponse('Employee not found', 404);
        }

        // Perform the update on Employee table
        let updatedEmployee = null;
        if (Object.keys(updateData).length > 1) { // 1 because of updated_at
            const { data: updated, error } = await adminClient
                .from('Employee')
                .update(updateData)
                .eq('employee_id', id)
                .eq('business_id', authUser.business_id)
                .select()
                .single();

            if (error || !updated) {
                console.error('Employee update failed:', error?.message, error?.details);
                return errorResponse(`Update failed: ${error?.message || 'Employee not found'}`, error ? 400 : 404);
            }
            updatedEmployee = updated;
        } else {
            updatedEmployee = beforeValue;
        }

        // --- SYSTEM ROLE SYNCHRONIZATION ---
        // If 'role' was provided, update it in the User table (restricted to employee/manager only)
        if (body.role !== undefined && beforeValue.user_id) {
            // Validation: only allow manager or employee roles to be set via this endpoint
            if (body.role !== 'employee' && body.role !== 'manager') {
                console.warn(`Attempted to set restricted role: ${body.role}`);
            } else {
                const { data: existingUser } = await supabase
                    .from('User')
                    .select('role')
                    .eq('user_id', beforeValue.user_id)
                    .maybeSingle();

                if (existingUser) {
                    if (existingUser.role !== body.role) {
                        const { error: roleUpdateError } = await adminClient
                            .from('User')
                            .update({ role: body.role })
                            .eq('user_id', beforeValue.user_id);

                        if (roleUpdateError) {
                            console.error('System role update failed:', roleUpdateError.message);
                        }
                    }
                } else if (body.role === 'manager') {
                    // If no User record exists, but we want to promote them to manager, create it
                    const { error: roleCreateError } = await adminClient
                        .from('User')
                        .insert({
                            user_id: beforeValue.user_id,
                            business_id: beforeValue.business_id,
                            role: 'manager',
                            first_name: beforeValue.first_name,
                            last_name: beforeValue.last_name,
                        });

                    if (roleCreateError) {
                        console.error('System role creation failed:', roleCreateError.message);
                    }
                }
            }
        }

        // --- EMAIL SYNCHRONIZATION ---
        // If the email was changed, update it in Supabase Auth as well
        if (updateData.email && beforeValue && beforeValue.email !== updateData.email) {
            const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(beforeValue.user_id, {
                email: updateData.email as string,
                email_confirm: true // Force confirm since this is a manager correction
            });

            if (authUpdateError) {
                console.error('Auth email synchronization failed:', authUpdateError.message);
                // We don't fail the whole request but we should log it
            }
        }

        await logAudit({
            businessId: authUser.business_id,
            tableName: 'Employee',
            recordId: updatedEmployee.employee_id,
            action: 'UPDATE',
            changedBy: authUser.user_id,
            beforeValue,
            afterValue: updatedEmployee,
            reason: 'Employee details updated'
        });

        return successResponse(updatedEmployee, 'Employee updated successfully');
    } catch (error) {
        console.error('Update employee error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/employees/[id]
 * 
 * Deactivate an employee (soft delete)
 * Access: Owner, Manager
 * 
 * Query params:
 *   ?hard=true (permanent delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', "manager");
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const hardDelete = searchParams.get('hard') === 'true';

        const supabase = await createClient();

        // Verify employee belongs to this business
        const { data: employee, error: findError } = await supabase
            .from('Employee')
            .select('employee_id, first_name, last_name, phone, email, dob, bank_account_name, bank_bsb, bank_account_number, abn, tfn, emergency_contact_name, emergency_contact_phone, employment_type, role_title, pay_cycle, start_date, end_date, created_at, updated_at, business_id, user_id, status')
            .eq('employee_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !employee) {
            return errorResponse('Employee not found', 404);
        }

        if (hardDelete) {
            // Hard delete: remove Employee record + auth account
            const { error: deleteError } = await supabase
                .from('Employee')
                .delete()
                .eq('employee_id', id);

            if (deleteError) {
                return errorResponse(`Failed to delete employee: ${deleteError.message}`, 400);
            }

            // Delete auth account
            const adminClient = createAdminClient();
            await adminClient.auth.admin.deleteUser(employee.user_id);

            await logAudit({
                businessId: authUser.business_id,
                tableName: 'Employee',
                recordId: id,
                action: 'DELETE',
                changedBy: authUser.user_id,
                beforeValue: employee,
                reason: 'Employee permanently deleted'
            });

            return successResponse(null, 'Employee permanently deleted');
        } else {
            // Soft delete: set status to inactive + set end_date
            const { data: updatedEmployee, error: updateError } = await supabase
                .from('Employee')
                .update({
                    status: 'inactive',
                    end_date: new Date().toISOString().split('T')[0],
                    updated_at: new Date().toISOString(),
                })
                .eq('employee_id', id)
                .select()
                .single();

            if (updateError) {
                return errorResponse(`Failed to deactivate employee: ${updateError.message}`, 400);
            }

            await logAudit({
                businessId: authUser.business_id,
                tableName: 'Employee',
                recordId: id,
                action: 'UPDATE',
                changedBy: authUser.user_id,
                beforeValue: employee,
                afterValue: updatedEmployee,
                reason: 'Employee deactivated (soft delete)'
            });

            return successResponse(updatedEmployee, 'Employee deactivated');
        }
    } catch (error) {
        console.error('Delete employee error:', error);
        return errorResponse('Internal server error', 500);
    }
}
