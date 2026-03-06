import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import bcrypt from 'bcryptjs';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/employees/[id]
 * 
 * Get a specific employee by employee_id
 * Access: Owner, Manager
 */GIT
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
            .select('employee_id, first_name, last_name, phone, email, dob, bank_details, emergency_contact_name, emergency_contact_phone, employment_type, role_title, pay_cycle, start_date, end_date, created_at, updated_at, business_id, user_id, status')
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

        return successResponse({
            ...employee,
            current_rate: currentRate || null,
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
        const authUser = await requireRole('owner', "manager");
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        // Whitelist updatable fields
        const allowedFields = [
            'first_name',
            'last_name',
            'phone',
            'email',
            'bank_details',
            'emergency_contact_name',
            'emergency_contact_phone',
            'employment_type',
            'role_title',
            'pay_cycle',
            'kiosk_pin',
            'end_date',
            'status',
        ];

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                if (field === 'kiosk_pin') {
                    updateData[field] = await bcrypt.hash(body[field], 10);
                } else {
                    updateData[field] = body[field];
                }
            }
        }

        if (Object.keys(updateData).length === 0) {
            return errorResponse('No valid fields to update', 400);
        }

        updateData.updated_at = new Date().toISOString();

        const { data: updatedEmployee, error } = await supabase
            .from('Employee')
            .update(updateData)
            .eq('employee_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error || !updatedEmployee) {
            return errorResponse('Employee not found or update failed', 404);
        }

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
            .select('*')
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

            return successResponse(updatedEmployee, 'Employee deactivated');
        }
    } catch (error) {
        console.error('Delete employee error:', error);
        return errorResponse('Internal server error', 500);
    }
}
