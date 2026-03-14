import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { checkShiftConflictWithLeave } from '@/lib/leave-logic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/shift/[id]
 * 
 * Get a specific shift
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { data: shift, error } = await supabase
            .from('Shift')
            .select('*, Employee:employee_id(*), Roster:roster_id(*)')
            .eq('shift_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error || !shift) return errorResponse('Shift not found', 404);

        return successResponse(shift);
    } catch (err) {
        console.error('Get shift error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PUT /api/shift/[id]
 * 
 * Update a shift
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "employee_id": "uuid",
 *   "start_time": "ISO_TIMESTAMP",
 *   "end_time": "ISO_TIMESTAMP",
 *   "shift_type": "morning"
 * }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        // Check shift exists and belongs to this business
        const { data: existing, error: findError } = await supabase
            .from('Shift')
            .select('*')
            .eq('shift_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !existing) return errorResponse('Shift not found', 404);
        
        // Check if shift has already started
        const now = new Date();
        const startTime = new Date(existing.start_time);
        if (now >= startTime) {
            return errorResponse('Cannot update a shift that has already started.', 400);
        }


        const updateData: Record<string, unknown> = {};
        const allowedFields = [
            'employee_id',
            'roster_id',
            'shift_date',
            'start_time',
            'end_time',
            'shift_type',
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return errorResponse('No valid fields to update', 400);
        }

        // If time is updated, re-check overlap
        const newStart = updateData.start_time || existing.start_time;
        const newEnd = updateData.end_time || existing.end_time;
        const newEmployee = updateData.employee_id || existing.employee_id;

        if (newEmployee) {
            // 1. Check for overlapping shifts
            const { data: overlapping } = await supabase
                .from('Shift')
                .select('shift_id')
                .eq('employee_id', newEmployee)
                .eq('business_id', authUser.business_id)
                .neq('shift_id', id)
                .lte('start_time', newEnd)
                .gte('end_time', newStart)
                .limit(1)
                .single();

            if (overlapping) {
                return errorResponse('This update creates an overlapping shift for the employee.', 409);
            }

            // 2. Check for approved leave
            const newShiftDate = updateData.shift_date as string || (existing.shift_date as string);
            const leaveConflicts = await checkShiftConflictWithLeave(authUser.business_id, newEmployee, newShiftDate);
            if (leaveConflicts.length > 0) {
                return errorResponse(`This employee has approved leave (${leaveConflicts[0].leave_type}) on this date.`, 409);
            }
        }

        updateData.updated_at = new Date().toISOString();

        const { data: updated, error } = await supabase
            .from('Shift')
            .update(updateData)
            .eq('shift_id', id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(updated, 'Shift updated successfully');
    } catch (err) {
        console.error('Update shift error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/shift/[id]
 * 
 * Delete a shift
 * Access: Owner, Manager
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { data: shift, error: findError } = await supabase
            .from('Shift')
            .select('*')
            .eq('shift_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !shift) return errorResponse('Shift not found', 404);

        // Check if shift has already started
        const now = new Date();
        const startTime = new Date(shift.start_time);
        if (now >= startTime) {
            return errorResponse('Cannot delete a shift that has already started.', 400);
        }


        const { error: deleteError } = await supabase
            .from('Shift')
            .delete()
            .eq('shift_id', id);

        if (deleteError) return errorResponse(deleteError.message, 400);

        return successResponse(null, 'Shift deleted successfully');
    } catch (err) {
        console.error('Delete shift error:', err);
        return errorResponse('Internal server error', 500);
    }
}
