import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { checkShiftConflictWithLeave } from '@/lib/leave-logic';

/**
 * GET /api/shift
 * 
 * List shifts based on filters
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const employee_id = searchParams.get('employee_id');
        const roster_id = searchParams.get('roster_id');
        const from_date = searchParams.get('from');
        const to_date = searchParams.get('to');

        const supabase = await createClient();

        let query = supabase
            .from('Shift')
            .select('*, Employee:employee_id(*), Roster:roster_id(*)')
            .eq('business_id', authUser.business_id)
            .order('shift_date', { ascending: false });

        if (employee_id) query = query.eq('employee_id', employee_id);
        if (roster_id) query = query.eq('roster_id', roster_id);
        if (from_date) query = query.gte('shift_date', from_date);
        if (to_date) query = query.lte('shift_date', to_date);

        const { data: shifts, error } = await query;

        if (error) return errorResponse(error.message, 400);

        return successResponse(shifts, `Found ${shifts.length} shift(s)`);
    } catch (err) {
        console.error('List shifts error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/shift
 * 
 * Create a new shift
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "employee_id": "uuid" (optional),
 *   "roster_id": "uuid" (optional),
 *   "shift_date": "2026-03-10",
 *   "start_time": "ISO_TIMESTAMP",
 *   "end_time": "ISO_TIMESTAMP",
 *   "shift_type": "morning" | "afternoon" | etc
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, [
            'shift_date',
            'start_time',
            'end_time',
            'shift_type',
        ]);
        if (validationError) return errorResponse(validationError, 400);

        const { employee_id, roster_id, shift_date, start_time, end_time, shift_type } = body;

        // Validate time order
        const start = new Date(start_time);
        const end = new Date(end_time);

        if (start >= end) {
            return errorResponse('start_time must be before end_time', 400);
        }

        const supabase = await createClient();

        // If an employee is assigned, check for overlapping shifts for that employee
        if (employee_id) {
            // 1. Check for overlapping shifts
            const { data: overlapping } = await supabase
                .from('Shift')
                .select('shift_id')
                .eq('employee_id', employee_id)
                .eq('business_id', authUser.business_id)
                .lte('start_time', end_time)
                .gte('end_time', start_time)
                .limit(1)
                .single();

            if (overlapping) {
                return errorResponse('This employee already has an overlapping shift.', 409);
            }

            // 2. Check for approved leave
            const leaveConflicts = await checkShiftConflictWithLeave(authUser.business_id, employee_id, shift_date);
            if (leaveConflicts.length > 0) {
                return errorResponse(`This employee has approved leave (${leaveConflicts[0].leave_type}) on this date.`, 409);
            }
        }

        const { data: shift, error } = await supabase
            .from('Shift')
            .insert({
                business_id: authUser.business_id,
                employee_id: employee_id || null,
                roster_id: roster_id || null,
                shift_date,
                start_time,
                end_time,
                shift_type,
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(shift, 'Shift created successfully', 201);
    } catch (err) {
        console.error('Create shift error:', err);
        return errorResponse('Internal server error', 500);
    }
}